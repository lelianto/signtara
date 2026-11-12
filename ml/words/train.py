"""
Trains the isolated word-sign classifier (words-v1) on holistic landmark sequences.

  ml/.venv/bin/python ml/words/train.py evaluate      # held-out metrics + threshold calibration
  ml/.venv/bin/python ml/words/train.py open-set      # false acceptance on classes never seen
  ml/.venv/bin/python ml/words/train.py release       # train on all data, export public/models/words-v1

Splits (variant 0 = un-augmented original only is ever evaluated):
  wl-bisindo: signer-independent. train s0,s1,s2 / val s4 / test s3 (a signer never seen).
  other sets (signer unknown): per class 70/15/15 by video, seeded.

Architecture (mirrored exactly by src/recognition/wordModel.ts):
  standardize → Conv1d(D,128,5) → [Conv1d(128,128,5) + residual] → [Conv1d(128,128,5,dil 2) + residual]
  → [Conv1d(128,128,3) + residual]; each conv followed by BatchNorm (folded at export) and ReLU;
  → concat(mean over time, max over time) → Linear(256, C) → softmax.
"""
import json, math, random, sys, time
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'ml/words/out'
SEED = 7
WIDTH = 128
EPOCHS = int(__import__('os').environ.get('EPOCHS', 70))

meta = json.loads((OUT / 'features.json').read_text())
T, D = meta['steps'], meta['dims']
L = meta['layout']
X_all = np.fromfile(OUT / 'features.bin', dtype=np.float32).reshape(-1, T, D)
samples = meta['samples']
assert len(samples) == len(X_all), (len(samples), len(X_all))
device = torch.device('mps' if torch.backends.mps.is_available() else 'cpu')

# Absolute body-relative positions (shifted and scaled) vs. relative offsets (scaled only).
ABS_IDX = np.r_[L['slots'][0]['wrist'][0]:L['slots'][0]['elbow'][1], L['slots'][1]['wrist'][0]:L['slots'][1]['elbow'][1], L['nose'][0]:L['nose'][1]]
REL_IDX = np.r_[L['slots'][0]['fromNose'][0]:L['slots'][0]['fromNose'][1], L['slots'][1]['fromNose'][0]:L['slots'][1]['fromNose'][1]]
SLOT_RANGES = [(s['present'], s['fromNose'][1]) for s in L['slots']]


def split_of(s, rng_by_class):
    if s['dataset'] == 'wl-bisindo':
        return {'s3': 'test', 's4': 'val'}.get(s['signer'], 'train')
    return rng_by_class[(s['dataset'], s['label'], s['id'])]


def make_splits():
    vids = defaultdict(list)
    for s in samples:
        if s['variant'] == 0 and s['dataset'] != 'wl-bisindo':
            vids[(s['dataset'], s['label'])].append(s['id'])
    assign = {}
    rnd = random.Random(SEED)
    for key, ids in vids.items():
        ids = sorted(ids); rnd.shuffle(ids)
        n = len(ids); nv = max(1, round(n * .15)); nt = max(1, round(n * .15))
        for i, vid in enumerate(ids):
            assign[(key[0], key[1], vid)] = 'test' if i < nt else 'val' if i < nt + nv else 'train'
    return [split_of(s, assign) for s in samples]


class Net(nn.Module):
    def __init__(self, d, c, width=WIDTH):
        super().__init__()
        spec = [(d, width, 5, 1, False), (width, width, 5, 1, True), (width, width, 5, 2, True), (width, width, 3, 1, True)]
        self.convs = nn.ModuleList(nn.Conv1d(i, o, k, padding=(k // 2) * dil, dilation=dil) for i, o, k, dil, _ in spec)
        self.bns = nn.ModuleList(nn.BatchNorm1d(o) for _, o, _, _, _ in spec)
        self.residual = [r for *_, r in spec]
        self.spec = spec
        self.drop = nn.Dropout(0.3)
        self.head = nn.Linear(2 * width, c)

    def forward(self, x):  # x: (B, T, D) standardized
        h = x.transpose(1, 2)
        for conv, bn, res in zip(self.convs, self.bns, self.residual):
            y = F.relu(bn(conv(h)))
            h = y + h if res else y
            h = F.dropout(h, 0.1, self.training)
        pooled = torch.cat([h.mean(2), h.amax(2)], 1)
        return self.head(self.drop(pooled))


def augment(x):
    """On-the-fly augmentation in raw feature space (before standardization)."""
    b = x.shape[0]
    x = x.clone()
    # Body-relative positions: small global scale and shift (camera height / distance differences).
    scale = 1 + (torch.rand(b, 1, 1, device=x.device) - .5) * .2
    shift = (torch.rand(b, 1, 2, device=x.device) - .5) * .2
    pos = (x[:, :, ABS_IDX] * scale).view(b, T, -1, 2) + shift.unsqueeze(2)
    x[:, :, ABS_IDX] = pos.view(b, T, -1)
    x[:, :, REL_IDX] = x[:, :, REL_IDX] * scale
    # Tracker dropout: blank one hand slot on ~10% of frames.
    for lo, hi in SLOT_RANGES:
        mask = (torch.rand(b, T, 1, device=x.device) < .08).float()
        x[:, :, lo:lo + 43] *= 1 - mask
    # Face missing on some whole sequences (camera angle / occlusion).
    face = (torch.rand(b, 1, 1, device=x.device) < .1).float()
    fl = slice(L['blend'][0], L['facePresent'] + 1)
    x[:, :, fl] *= 1 - face
    return x + torch.randn_like(x) * .01


def standardizer(x):
    flat = x.reshape(-1, D)
    mean = flat.mean(0)
    std = flat.std(0)
    std[std < 1e-3] = 1.0
    return mean.astype(np.float32), std.astype(np.float32)


def train(train_idx, classes, epochs=EPOCHS, log=True):
    cls_index = {c: i for i, c in enumerate(classes)}
    X = X_all[train_idx]
    y = np.array([cls_index[samples[i]['label']] for i in train_idx])
    mean, std = standardizer(X)
    Xt = torch.tensor(X, device=device)
    yt = torch.tensor(y, device=device)
    mt, st = torch.tensor(mean, device=device), torch.tensor(std, device=device)
    torch.manual_seed(SEED)
    net = Net(D, len(classes)).to(device)
    opt = torch.optim.AdamW(net.parameters(), lr=2e-3, weight_decay=1e-2)
    steps = epochs * math.ceil(len(X) / 128)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=3e-3, total_steps=steps, pct_start=.15)
    # Balance datasets/classes: weight each sample by 1/count(class).
    counts = Counter(y.tolist())
    weights = torch.tensor([1.0 / counts[v] for v in y.tolist()], device=device)
    t0 = time.time()
    for ep in range(epochs):
        net.train()
        order = torch.multinomial(weights, len(y), replacement=True)
        total = 0.0
        for k in range(0, len(order), 128):
            idx = order[k:k + 128]
            xb = (augment(Xt[idx]) - mt) / st
            loss = F.cross_entropy(net(xb), yt[idx], label_smoothing=.1)
            opt.zero_grad(); loss.backward(); opt.step(); sched.step()
            total += loss.item() * len(idx)
        if log and (ep % 10 == 0 or ep == epochs - 1):
            print(f'  epoch {ep:3d} loss {total / len(y):.3f} ({time.time() - t0:.0f}s)', flush=True)
    net.eval()
    return net, mean, std


@torch.no_grad()
def predict(net, mean, std, idx):
    x = (torch.tensor(X_all[idx], device=device) - torch.tensor(mean, device=device)) / torch.tensor(std, device=device)
    out = []
    for k in range(0, len(x), 512):
        out.append(F.softmax(net(x[k:k + 512]), 1).cpu().numpy())
    return np.concatenate(out) if out else np.zeros((0, 0))


def report(name, probs, labels, classes):
    if not len(labels):
        return {}
    ci = {c: i for i, c in enumerate(classes)}
    y = np.array([ci[l] for l in labels])
    top = np.argsort(-probs, 1)
    acc = float((top[:, 0] == y).mean())
    top3 = float((top[:, :3] == y[:, None]).any(1).mean())
    confusions = Counter((classes[a], classes[b]) for a, b in zip(y, top[:, 0]) if a != b).most_common(6)
    print(f'  {name}: n={len(y)} top1={acc:.3f} top3={top3:.3f}  confusions={confusions}')
    return {'n': len(y), 'top1': round(acc, 4), 'top3': round(top3, 4), 'confusions': [[a, b, n] for (a, b), n in confusions]}


def calibrate(probs, labels, classes, target=0.95):
    """Smallest (minProb, minMargin) on validation whose accepted precision >= target; maximizes coverage."""
    ci = {c: i for i, c in enumerate(classes)}
    y = np.array([ci[l] for l in labels])
    s = np.sort(probs, 1)
    p1, p2 = s[:, -1], s[:, -2]
    correct = probs.argmax(1) == y
    best = (0.9, 0.5, 0.0, 1.0)
    for mp in np.arange(.2, .96, .05):
        for mm in np.arange(0, .61, .05):
            acc = (p1 >= mp) & (p1 - p2 >= mm)
            if acc.sum() < 10:
                continue
            prec = correct[acc].mean(); cov = acc.mean()
            if prec >= target and cov > best[2]:
                best = (round(float(mp), 2), round(float(mm), 2), float(cov), float(prec))
    print(f'  calibration: minProb={best[0]} minMargin={best[1]} coverage={best[2]:.3f} precision={best[3]:.3f}')
    return {'minProb': best[0], 'minMargin': best[1], 'valCoverage': round(best[2], 4), 'valPrecision': round(best[3], 4)}


def accepted_stats(probs, labels, classes, th):
    ci = {c: i for i, c in enumerate(classes)}
    y = np.array([ci[l] for l in labels])
    s = np.sort(probs, 1)
    acc = (s[:, -1] >= th['minProb']) & (s[:, -1] - s[:, -2] >= th['minMargin'])
    correct = probs.argmax(1) == y
    return {'coverage': round(float(acc.mean()), 4), 'precision': round(float(correct[acc].mean()) if acc.any() else 0, 4)}


def evaluate(holdout_classes=0):
    splits = make_splits()
    classes = sorted({s['label'] for s in samples})
    unseen = set()
    if holdout_classes:
        rnd = random.Random(SEED)
        unseen = set(rnd.sample(classes, holdout_classes))
        classes = [c for c in classes if c not in unseen]
    tr = [i for i, s in enumerate(samples) if splits[i] == 'train' and s['label'] not in unseen]
    print(f'train sequences {len(tr)}, classes {len(classes)}, device {device}')
    net, mean, std = train(tr, classes)
    result = {'classes': len(classes)}
    for part in ('val', 'test'):
        for ds in sorted({s['dataset'] for s in samples}):
            idx = [i for i, s in enumerate(samples) if splits[i] == part and s['variant'] == 0 and s['dataset'] == ds and s['label'] not in unseen]
            if idx:
                result[f'{part}:{ds}'] = report(f'{part}:{ds}', predict(net, mean, std, idx), [samples[i]['label'] for i in idx], classes)
    val = [i for i, s in enumerate(samples) if splits[i] == 'val' and s['variant'] == 0 and s['label'] not in unseen]
    th = calibrate(predict(net, mean, std, val), [samples[i]['label'] for i in val], classes)
    result['thresholds'] = th
    for ds in sorted({s['dataset'] for s in samples}):
        idx = [i for i, s in enumerate(samples) if splits[i] == 'test' and s['variant'] == 0 and s['dataset'] == ds and s['label'] not in unseen]
        if idx:
            result[f'test-accepted:{ds}'] = accepted_stats(predict(net, mean, std, idx), [samples[i]['label'] for i in idx], classes, th)
            print(f'  test-accepted:{ds}', result[f'test-accepted:{ds}'])
    if unseen:
        idx = [i for i, s in enumerate(samples) if s['variant'] == 0 and s['label'] in unseen]
        p = np.sort(predict(net, mean, std, idx), 1)
        fa = float(((p[:, -1] >= th['minProb']) & (p[:, -1] - p[:, -2] >= th['minMargin'])).mean())
        print(f'  open-set: {len(idx)} videos of {sorted(unseen)} never trained; falsely accepted {fa:.3f}')
        result['openSet'] = {'unseen': sorted(unseen), 'videos': len(idx), 'falseAcceptance': round(fa, 4)}
    return result


def fold(conv, bn):
    w = conv.weight.detach().cpu().double()
    b = conv.bias.detach().cpu().double()
    g = (bn.weight / torch.sqrt(bn.running_var + bn.eps)).detach().cpu().double()
    w2 = w * g[:, None, None]
    b2 = (b - bn.running_mean.detach().cpu().double()) * g + bn.bias.detach().cpu().double()
    return w2.numpy(), b2.numpy()


def r(a):
    return [float(f'{v:.6g}') for v in np.asarray(a).ravel()]


def release(metrics_path):
    classes = sorted({s['label'] for s in samples})
    idx = list(range(len(samples)))
    print(f'release: training on all {len(idx)} sequences, {len(classes)} classes')
    net, mean, std = train(idx, classes)
    net = net.cpu()
    layers = []
    for (i, o, k, dil, res), conv, bn in zip(net.spec, net.convs, net.bns):
        w, b = fold(conv, bn)
        layers.append({'inC': i, 'outC': o, 'k': k, 'dilation': dil, 'residual': res, 'w': r(w), 'b': r(b)})
    metrics = json.loads(Path(metrics_path).read_text()) if Path(metrics_path).exists() else {}
    licenses = sorted({s['license'] for s in samples})
    datasets = sorted({s['dataset'] for s in samples})
    model = {
        'version': 'words-v1', 'featureVersion': meta['featureVersion'], 'steps': T, 'dims': D,
        'classes': classes, 'mean': r(mean), 'std': r(std), 'layers': layers,
        'head': {'inF': 2 * WIDTH, 'outF': len(classes), 'w': r(net.head.weight.detach().numpy()), 'b': r(net.head.bias.detach().numpy())},
        'thresholds': metrics.get('evaluate', {}).get('thresholds', {'minProb': .6, 'minMargin': .2}),
        'datasets': datasets, 'licenses': licenses,
        'license': 'CC BY-NC 4.0' if any('NC' in l for l in licenses) else 'MIT',
        'trainedOn': len(idx),
    }
    out = ROOT / 'public/models/words-v1'
    out.mkdir(parents=True, exist_ok=True)
    (out / 'model.json').write_text(json.dumps(model, separators=(',', ':')))
    # Parity fixture: torch probabilities for a few real sequences, checked by the TS unit test.
    pick = [i for i, s in enumerate(samples) if s['variant'] == 0][:: max(1, len(samples) // 40)][:6]
    with torch.no_grad():
        x = (torch.tensor(X_all[pick]) - torch.tensor(mean)) / torch.tensor(std)
        probs = F.softmax(net(x), 1).numpy()
    (out / 'parity-fixture.json').write_text(json.dumps({'inputs': [X_all[i].round(5).tolist() for i in pick], 'probs': probs.round(6).tolist(), 'labels': [samples[i]['label'] for i in pick]}))
    print(f'wrote {out}/model.json ({(out / "model.json").stat().st_size / 1e6:.2f} MB)')


if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'evaluate'
    metrics_path = OUT / 'metrics.json'
    metrics = json.loads(metrics_path.read_text()) if metrics_path.exists() else {}
    if mode == 'evaluate':
        metrics['evaluate'] = evaluate()
    elif mode == 'open-set':
        metrics['openSet'] = evaluate(holdout_classes=6)
    elif mode == 'release':
        release(metrics_path)
        sys.exit(0)
    metrics_path.write_text(json.dumps(metrics, indent=1))
