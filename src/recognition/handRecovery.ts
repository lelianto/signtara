import type{Point}from'./twoHand';
export function unmirrorHands<T extends Point>(hands:T[][]):T[][]{return hands.map(h=>h.map(p=>({...p,x:1-p.x})))}
function size(hand:Point[]){return Math.max(.001,...hand.map(p=>Math.hypot(p.x-hand[0].x,p.y-hand[0].y)))}
/** Conservative deduplication of simultaneous detections, never a second fabricated hand. */
export function sameHand(a:Point[],b:Point[]){
 const scale=Math.max(size(a),size(b));
 const distances=a.map((p,i)=>Math.hypot(p.x-b[i].x,p.y-b[i].y)).sort((x,y)=>x-y);
 const wrist=Math.hypot(a[0].x-b[0].x,a[0].y-b[0].y);
 const cx=a.reduce((s,p,i)=>s+(p.x-b[i].x),0)/a.length,cy=a.reduce((s,p,i)=>s+(p.y-b[i].y),0)/a.length;
 const center=Math.hypot(cx,cy);
 return (distances[10]/scale<.30&&wrist/scale<.45)||(center/scale<.28&&wrist/scale<.38);
}
export function mergeDetectedHands<T extends Point>(primary:T[][],additional:T[][]){
 const unique:T[][]=[];
 for(const hand of [...primary,...additional])if(hand.length===21&&!unique.some(h=>sameHand(h,hand))){unique.push(hand);if(unique.length===2)break}
 return unique;
}
