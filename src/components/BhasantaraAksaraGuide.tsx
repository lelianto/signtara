import React, { useState } from 'react';
import { Copy, Check, BookOpen, Volume2, Sparkles, MapPin, Users, ArrowRightLeft } from 'lucide-react';
import {
  aksaraGuideData,
  transliterateToAksara,
  analyzeCulturalLiteracy,
  regionalLanguages,
  type AksaraScript,
  type AksaraItem,
  type TransliterateDirection,
  type RegionalLanguageCode,
  speakText,
} from '../language/bhasantara';

export function BhasantaraAksaraGuide({
  initialScript = 'JAVANESE',
}: {
  initialScript?: AksaraScript;
}) {
  const [selectedScript, setSelectedScript] = useState<AksaraScript>(initialScript);
  const [direction, setDirection] = useState<TransliterateDirection>('LATIN_TO_AKSARA');
  const [activeCategory, setActiveCategory] = useState<string>('Nglegena');
  const [copiedChar, setCopiedChar] = useState<string | null>(null);
  const [sampleText, setSampleText] = useState<string>('matur nuwun');
  const [copiedSample, setCopiedSample] = useState(false);

  // Cultural Literacy & Etymology state (from Bhasantara Tab 2)
  const [literacyLang, setLiteracyLang] = useState<RegionalLanguageCode>('jv');
  const [literacyQuery, setLiteracyQuery] = useState<string>('matur nuwun');

  // Regional Preservation Stats state (from Bhasantara LanguageStats.tsx)
  const [statLangCode, setStatLangCode] = useState<RegionalLanguageCode>('jv');

  const currentData = aksaraGuideData[selectedScript];
  const categoryNames = Object.keys(currentData);
  const safeCategory = categoryNames.includes(activeCategory) ? activeCategory : categoryNames[0];

  const convertedSample = transliterateToAksara(sampleText, selectedScript, direction);
  const literacyResult = analyzeCulturalLiteracy(literacyQuery, literacyLang);
  const selectedStatLang = regionalLanguages.find(l => l.code === statLangCode) || regionalLanguages[0];

  const handleCardClick = (item: AksaraItem) => {
    navigator.clipboard?.writeText(item.glyph).catch(() => {});
    setCopiedChar(`${item.latin}-${item.glyph}`);
    if (direction === 'AKSARA_TO_LATIN') {
      setSampleText(prev => `${prev}${item.glyph}`);
    }
    setTimeout(() => setCopiedChar(null), 1400);
  };

  const handleSwapDirection = () => {
    const nextDir: TransliterateDirection =
      direction === 'LATIN_TO_AKSARA' ? 'AKSARA_TO_LATIN' : 'LATIN_TO_AKSARA';
    setSampleText(convertedSample);
    setDirection(nextDir);
  };

  const handleCopySample = () => {
    if (!convertedSample) return;
    navigator.clipboard?.writeText(convertedSample).catch(() => {});
    setCopiedSample(true);
    setTimeout(() => setCopiedSample(false), 1500);
  };

  return (
    <div className="bhasantara-modules">
      {/* 1. Interactive Aksara Guide & Bidirectional Converter */}
      <section className="aksara-guide" aria-label="Kamus Alphabet dan Literasi Aksara">
        <div className="aksara-header">
          <div>
            <h3>
              <BookOpen size={20} strokeWidth={1.8} /> Kamus Alphabet &amp; Transliterasi Aksara Nusantara
            </h3>
            <p>
              Diadaptasi dari modul literasi aksara BHASANTARA. Konversi dua arah antara Teks Latin dan Aksara Jawa, Sunda, serta Bali, atau klik kartu aksara untuk menyalin simbol Unicode.
            </p>
          </div>
          <div className="aksara-script-tabs" role="tablist" aria-label="Pilih Aksara Nusantara">
            {(
              [
                ['JAVANESE', 'Aksara Jawa', 'Nglegena'],
                ['SUNDANESE', 'Aksara Sunda', 'Ngangalagena'],
                ['BALINESE', 'Aksara Bali', 'Wianjana'],
              ] as const
            ).map(([code, label, defaultCat]) => (
              <button
                key={code}
                type="button"
                role="tab"
                aria-selected={selectedScript === code}
                className={selectedScript === code ? 'selected' : ''}
                onClick={() => {
                  setSelectedScript(code);
                  setActiveCategory(defaultCat);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="aksara-converter">
          <div className="aksara-converter-input">
            <div className="aksara-converter-head">
              <label htmlFor="aksara-latin-input">
                {direction === 'LATIN_TO_AKSARA'
                  ? 'LATIN KE AKSARA (LOKAL INSTAN)'
                  : 'AKSARA KE LATIN (LOKAL INSTAN)'}
              </label>
              <button
                type="button"
                onClick={handleSwapDirection}
                title="Tukar arah konversi Latin dan Aksara"
              >
                <ArrowRightLeft size={16} strokeWidth={2} />
                <span>{direction === 'LATIN_TO_AKSARA' ? 'Latin ➔ Aksara' : 'Aksara ➔ Latin'}</span>
              </button>
            </div>
            <input
              id="aksara-latin-input"
              type="text"
              value={sampleText}
              onChange={e => setSampleText(e.target.value)}
              placeholder={
                direction === 'LATIN_TO_AKSARA'
                  ? 'Ketik kata (misal: sugeng enjang, sampurasun, matur suksma)…'
                  : 'Tempel atau klik kartu aksara di bawah…'
              }
            />
          </div>
          <div className="aksara-converter-output">
            <div className="aksara-converter-head">
              <span>
                {direction === 'LATIN_TO_AKSARA'
                  ? `HASIL ${selectedScript === 'JAVANESE' ? 'AKSARA JAWA' : selectedScript === 'SUNDANESE' ? 'AKSARA SUNDA' : 'AKSARA BALI'}`
                  : 'HASIL BACAAN LATIN'}
              </span>
              <div>
                <button
                  type="button"
                  onClick={() => speakText(direction === 'LATIN_TO_AKSARA' ? sampleText : convertedSample)}
                  title="Dengarkan pengucapan"
                  aria-label="Dengarkan pengucapan"
                >
                  <Volume2 size={16} strokeWidth={2} />
                </button>
                <button
                  type="button"
                  onClick={handleCopySample}
                  title="Salin Aksara"
                  aria-label="Salin Aksara"
                >
                  {copiedSample ? <Check size={16} strokeWidth={2} /> : <Copy size={16} strokeWidth={2} />}
                  <span>{copiedSample ? 'Tersalin' : 'Salin Hasil'}</span>
                </button>
              </div>
            </div>
            <div className="aksara-glyph-preview" data-testid="aksara-converter-result">
              {convertedSample || '—'}
            </div>
          </div>
        </div>

        <div className="aksara-categories">
          {categoryNames.map(catName => (
            <button
              key={catName}
              type="button"
              className={safeCategory === catName ? 'selected' : ''}
              onClick={() => setActiveCategory(catName)}
            >
              {catName}
            </button>
          ))}
        </div>

        <div className="aksara-grid">
          {currentData[safeCategory]?.map((item, idx) => {
            const itemKey = `${item.latin}-${item.glyph}`;
            const isCopied = copiedChar === itemKey;
            return (
              <button
                key={`${itemKey}-${idx}`}
                type="button"
                className="aksara-card"
                onClick={() => handleCardClick(item)}
                title={`Klik untuk menyalin ${item.glyph} (${item.latin})`}
              >
                <strong className="aksara-glyph">{item.glyph}</strong>
                <small>{item.latin}</small>
                {isCopied && <span className="aksara-copied">Tersalin</span>}
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. Cultural Literacy & Etymology Analyzer (from Bhasantara Tab 2) */}
      <section className="aksara-guide" aria-label="Asisten Literasi Budaya dan Etimologi">
        <div className="aksara-header">
          <div>
            <h3>
              <Sparkles size={20} strokeWidth={1.8} /> Analisis Literasi Budaya &amp; Etimologi Nusantara
            </h3>
            <p>
              Bedah makna filosofis, asal-usul kata (etimologi), tingkatan ragam tutur, dan contoh pemakaian kontekstual dari istilah bahasa daerah.
            </p>
          </div>
          <div className="dict-lang-pills" style={{ margin: 0 }}>
            {(
              [
                ['matur nuwun', 'jv', 'Matur Nuwun (Jawa)'],
                ['sampurasun', 'sun', 'Sampurasun (Sunda)'],
                ['om swastyastu', 'ban', 'Om Swastyastu (Bali)'],
                ['mator sakalangkong', 'mad', 'Sakalangkong (Madura)'],
                ['horas', 'bbc', 'Horas (Batak)'],
                ['siri na pacce', 'bug', 'Siri na Pacce (Bugis)'],
                ['huma betang', 'nij', 'Huma Betang (Ngaju)'],
              ] as const
            ).map(([q, code, label]) => (
              <button
                key={q}
                type="button"
                className={literacyQuery.toLowerCase() === q ? 'selected' : ''}
                onClick={() => {
                  setLiteracyQuery(q);
                  setLiteracyLang(code);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="literacy-controls">
          <input
            type="text"
            aria-label="Topik literasi budaya"
            value={literacyQuery}
            onChange={e => setLiteracyQuery(e.target.value)}
            placeholder="Ketik istilah daerah (misal: matur nuwun, sampurasun, horas, siri na pacce)…"
          />
          <select
            aria-label="Bahasa literasi budaya"
            value={literacyLang}
            onChange={e => setLiteracyLang(e.target.value as RegionalLanguageCode)}
          >
            {regionalLanguages
              .filter(l => l.code !== 'id')
              .map(l => (
                <option key={l.code} value={l.code}>
                  Bahasa {l.name} ({l.nativeName})
                </option>
              ))}
          </select>
        </div>

        <div className="word-grid" data-testid="cultural-literacy-card">
          <article>
            <span className="draft">Analisis Makna &amp; Etimologi</span>
            <strong className="glossary-term">{literacyResult.term}</strong>
            <p>{literacyResult.analysis}</p>
            <p>
              <b>Etimologi:</b> {literacyResult.etymology}
            </p>
          </article>
          <article>
            <span className="draft">Filosofi Budaya &amp; Ragam Tutur</span>
            <strong className="glossary-term">{literacyResult.registerLevel}</strong>
            <p>{literacyResult.culturalInsight}</p>
            {literacyResult.usageExamples.length > 0 && (
              <p>
                <b>Contoh:</b> {literacyResult.usageExamples.join(' · ')}
              </p>
            )}
          </article>
        </div>
      </section>

      {/* 3. Peta Preservasi & Statistik Bahasa Daerah (from Bhasantara LanguageStats.tsx) */}
      <section className="aksara-guide" aria-label="Peta Preservasi Bahasa Daerah">
        <div className="aksara-header">
          <div>
            <h3>
              <MapPin size={20} strokeWidth={1.8} /> Peta Preservasi &amp; Dialek Bahasa Daerah Nusantara
            </h3>
            <p>
              Eksplorasi wilayah tutur, estimasi jumlah penutur, status preservasi, dan daftar sub-dialek dari{' '}
              {regionalLanguages.filter(l => l.code !== 'id').length} bahasa daerah di korpus BHASANTARA × NusaX.
            </p>
          </div>
          <div className="dict-lang-pills" style={{ margin: 0 }}>
            {regionalLanguages
              .filter(l => l.code !== 'id')
              .map(l => (
                <button
                  key={l.code}
                  type="button"
                  className={statLangCode === l.code ? 'selected' : ''}
                  onClick={() => setStatLangCode(l.code)}
                >
                  {l.name}
                </button>
              ))}
          </div>
        </div>

        <div className="preservation-stats-grid">
          <div className="stat-box">
            <span>WILAYAH TUTUR</span>
            <strong>{selectedStatLang.region}</strong>
            <small>{selectedStatLang.nativeName}</small>
          </div>
          <div className="stat-box">
            <span>
              <Users size={15} strokeWidth={2} /> ESTIMASI PENUTUR
            </span>
            <strong>{selectedStatLang.speakers}</strong>
            <small>{selectedStatLang.preservationStatus}</small>
          </div>
          <div className="stat-box">
            <span>KORPUS &amp; DIALEK</span>
            <strong>{selectedStatLang.entriesCount}</strong>
            <small>
              {selectedStatLang.dialects.length > 0
                ? selectedStatLang.dialects.map(d => d.name).join(', ')
                : 'Dialek standar daerah'}
            </small>
          </div>
        </div>
      </section>
    </div>
  );
}
