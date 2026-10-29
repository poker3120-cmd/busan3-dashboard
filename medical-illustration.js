/* 검사 주제별 로컬 의료 개념도
   외부 이미지 요청 없이 브라우저에서 SVG를 생성합니다.
   임상 사진이나 진단용 이미지를 대체하지 않는 설명용 도식입니다. */

const TOPICS = [
  {
    key: "artery",
    label: "동맥·혈관",
    match: /동맥경화|죽상경화|혈관|심혈관|관상동맥|혈류|혈전|말초혈관/i,
    svg: `
      <g transform="translate(0 0)">
        <path d="M58 190 C185 138 294 158 401 182 S624 210 742 165 L742 315 C620 363 512 334 401 309 S181 289 58 330Z" fill="#a82a43" opacity=".94"/>
        <path d="M58 205 C178 168 286 184 400 204 S621 231 742 188 L742 292 C624 332 513 309 400 289 S180 276 58 313Z" fill="#f08b99"/>
        <path d="M58 226 C176 194 286 210 400 227 S626 252 742 211 L742 269 C621 301 515 284 400 267 S178 248 58 290Z" fill="#fff0ed"/>
        <path d="M335 199 C385 205 403 217 436 219 C462 220 473 206 506 211 C539 216 550 236 578 237 L585 282 C547 278 520 260 493 263 C458 268 443 287 411 276 C383 266 364 241 335 239Z" fill="#f1c75b" stroke="#d69730" stroke-width="4"/>
        <path d="M82 243 C99 235 110 237 123 245 M144 231 C159 226 174 227 187 235 M222 239 C237 236 248 238 261 244 M609 250 C625 246 640 244 654 246" fill="none" stroke="#f8b2ba" stroke-width="5" stroke-linecap="round"/>
        <g fill="#c94358" stroke="#f3a2ad" stroke-width="3">
          <ellipse cx="147" cy="258" rx="16" ry="8" transform="rotate(-9 147 258)"/>
          <ellipse cx="245" cy="257" rx="16" ry="8" transform="rotate(7 245 257)"/>
          <ellipse cx="304" cy="251" rx="16" ry="8" transform="rotate(-4 304 251)"/>
          <ellipse cx="628" cy="260" rx="16" ry="8" transform="rotate(8 628 260)"/>
          <ellipse cx="682" cy="248" rx="16" ry="8" transform="rotate(-7 682 248)"/>
        </g>
        <path d="M474 143 L474 187" stroke="#b27b25" stroke-width="3" stroke-linecap="round"/>
        <circle cx="474" cy="135" r="7" fill="#f1c75b"/>
        <path d="M472 126 L450 108" stroke="#b27b25" stroke-width="2" stroke-linecap="round"/>
      </g>`
  },
  {
    key: "liver",
    label: "간",
    match: /간암|간염|간기능|간섬유화|간질환|간세포|간경변|간암위험도/i,
    svg: `
      <g transform="translate(0 4)">
        <path d="M139 239 C161 160 267 111 391 128 C451 136 487 166 534 164 C588 162 623 142 667 165 C711 188 699 256 658 293 C622 326 548 345 467 332 C403 322 359 296 302 303 C237 311 174 300 145 273 C135 264 133 251 139 239Z" fill="url(#organ)" stroke="#a8354b" stroke-width="7"/>
        <path d="M404 137 C422 181 423 231 401 287" fill="none" stroke="#eaa0a8" stroke-width="8" stroke-linecap="round" opacity=".85"/>
        <path d="M403 217 C454 213 499 231 539 268" fill="none" stroke="#9e3047" stroke-width="7" stroke-linecap="round" opacity=".8"/>
        <path d="M402 218 C360 204 330 181 312 154" fill="none" stroke="#9e3047" stroke-width="7" stroke-linecap="round" opacity=".8"/>
        <path d="M402 218 C438 186 465 166 504 160 M402 218 C448 231 482 258 516 292 M402 218 C384 253 365 275 341 290 M402 218 C409 260 419 288 440 311" fill="none" stroke="#f3c4a9" stroke-width="6" stroke-linecap="round" opacity=".9"/>
        <path d="M504 160 L533 151 M516 292 L545 304 M341 290 L315 309 M440 311 L452 332" fill="none" stroke="#f3c4a9" stroke-width="4" stroke-linecap="round" opacity=".9"/>
      </g>`
  },
  {
    key: "heart",
    label: "심장",
    match: /심장|심근|심부전|심전도|심혈관|관상동맥|심장질환/i,
    svg: `
      <g transform="translate(0 -4)">
        <path d="M401 335 C359 294 235 223 236 165 C237 113 294 93 337 121 C364 139 382 160 401 181 C421 156 445 126 477 117 C525 104 568 139 563 183 C557 239 450 306 401 335Z" fill="url(#organ)" stroke="#a62843" stroke-width="7"/>
        <path d="M391 170 C366 143 360 109 378 87 C393 70 416 78 423 101 C431 127 414 152 401 181" fill="none" stroke="#b72c49" stroke-width="21" stroke-linecap="round"/>
        <path d="M425 145 C448 118 464 85 458 58" fill="none" stroke="#b72c49" stroke-width="18" stroke-linecap="round"/>
        <path d="M386 186 C352 208 333 235 322 265 M416 192 C446 218 457 244 465 272" fill="none" stroke="#f7bac1" stroke-width="9" stroke-linecap="round"/>
        <path d="M330 176 C350 183 366 199 379 220 M475 171 C457 190 443 207 432 226" fill="none" stroke="#f7bac1" stroke-width="8" stroke-linecap="round"/>
      </g>`
  },
  {
    key: "lung",
    label: "폐",
    match: /폐암|폐기능|폐질환|호흡기|기관지|폐렴|폐결절/i,
    svg: `
      <g fill="url(#organ)" stroke="#a83a57" stroke-width="6" stroke-linejoin="round">
        <path d="M385 125 L385 208 C354 204 334 180 316 165 C291 149 275 173 262 201 C243 243 225 296 251 320 C278 345 329 319 361 291 C387 267 393 230 393 202 L393 126Z"/>
        <path d="M415 125 L415 208 C446 204 466 180 484 165 C509 149 525 173 538 201 C557 243 575 296 549 320 C522 345 471 319 439 291 C413 267 407 230 407 202 L407 126Z"/>
      </g>
      <path d="M400 91 L400 210 M400 153 L350 196 M400 153 L450 196 M350 196 L320 238 M450 196 L480 238" fill="none" stroke="#b63c55" stroke-width="17" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M400 92 L400 210 M400 153 L350 196 M400 153 L450 196 M350 196 L320 238 M450 196 L480 238" fill="none" stroke="#f9d9d9" stroke-width="5" stroke-linecap="round"/>
    `
  },
  {
    key: "brain",
    label: "뇌",
    match: /뇌혈관|뇌졸중|치매|알츠하이머|인지기능|뇌기능|신경퇴행|뇌질환/i,
    svg: `
      <path d="M398 111 C373 77 323 84 309 117 C272 106 247 139 258 170 C224 195 241 236 267 250 C258 288 294 314 325 296 C348 323 380 306 398 286 C416 306 448 323 471 296 C502 314 538 288 529 250 C555 236 572 195 538 170 C549 139 524 106 487 117 C473 84 423 77 398 111Z" fill="url(#organ)" stroke="#ad5562" stroke-width="6"/>
      <path d="M398 110 L398 286 M315 131 C344 143 341 165 324 178 M277 183 C305 186 311 206 295 222 M313 270 C337 254 355 267 353 292 M475 131 C450 143 455 165 472 178 M519 183 C491 186 485 206 501 222 M483 270 C459 254 441 267 443 292 M348 111 C368 125 360 143 346 151 M448 111 C428 125 436 143 450 151" fill="none" stroke="#fbe5de" stroke-width="7" stroke-linecap="round"/>
    `
  },
  {
    key: "kidney",
    label: "신장",
    match: /신장|콩팥|신부전|신기능|요로|단백뇨|신장질환/i,
    svg: `
      <path d="M330 112 C275 93 236 143 241 207 C245 268 284 311 328 294 C365 280 361 240 340 218 C317 194 318 169 344 149 C359 137 350 119 330 112Z" fill="url(#organ)" stroke="#a63a54" stroke-width="7"/>
      <path d="M470 112 C525 93 564 143 559 207 C555 268 516 311 472 294 C435 280 439 240 460 218 C483 194 482 169 456 149 C441 137 450 119 470 112Z" fill="url(#organ)" stroke="#a63a54" stroke-width="7"/>
      <path d="M330 195 C369 198 375 231 399 246 C423 231 429 198 470 195" fill="none" stroke="#e4ac66" stroke-width="13" stroke-linecap="round"/>
      <path d="M330 195 C362 203 372 254 383 284 M470 195 C438 203 428 254 417 284" fill="none" stroke="#d1a45c" stroke-width="8" stroke-linecap="round"/>
    `
  },
  {
    key: "thyroid",
    label: "갑상선",
    match: /갑상선|갑상샘|티록신|갑상선호르몬/i,
    svg: `
      <g fill="url(#organ)" stroke="#ad3f5b" stroke-width="7">
        <path d="M374 163 C340 116 299 145 301 196 C302 238 329 269 363 256 C389 246 387 208 374 163Z"/>
        <path d="M426 163 C460 116 501 145 499 196 C498 238 471 269 437 256 C411 246 413 208 426 163Z"/>
      </g>
      <path d="M400 132 L400 330" stroke="#c8a6a3" stroke-width="32" stroke-linecap="round"/>
      <path d="M400 132 L400 330" stroke="#f6d9d7" stroke-width="20" stroke-linecap="round"/>
      <path d="M386 184 L414 184 M386 213 L414 213 M386 242 L414 242 M386 271 L414 271 M386 300 L414 300" stroke="#c89a9c" stroke-width="5" stroke-linecap="round"/>
    `
  },
  {
    key: "stomach",
    label: "위·헬리코박터",
    match: /헬리코박터|h\.?\s*pylori|pylori|위암|위염|위장|위점막|소화성\s*궤양|gastric|stomach|ulcer|helicobacter/i,
    svg: `
      <g>
        <path d="M346 72 C340 115 348 158 333 190 C318 220 279 237 263 274 C247 311 269 349 310 363 C353 379 414 365 454 338 C503 306 529 261 511 218 C502 194 484 182 463 185 C445 186 435 203 432 223 C426 249 407 271 381 274 C360 276 344 260 345 239 C348 203 375 173 374 139 C374 114 366 88 363 72 Z"
          fill="#f2c0c3" stroke="#a83b55" stroke-width="7" stroke-linejoin="round"/>
        <path d="M368 100 C367 143 379 166 362 194 C344 224 315 237 302 271 C288 308 316 333 354 336 C392 338 433 318 461 291"
          fill="none" stroke="#d97c8b" stroke-width="17" stroke-linecap="round"/>
        <path d="M365 102 C368 133 371 157 360 179" fill="none" stroke="#fff0f1" stroke-width="5" stroke-linecap="round"/>
      </g>
      <g stroke="#a33a52" stroke-width="3.5" stroke-linecap="round" fill="#d9a04b">
        <rect x="470" y="110" width="50" height="15" rx="7.5" transform="rotate(25 495 117)"/>
        <path d="M470 111 Q450 103 449 88 M486 119 Q479 138 463 141 M505 122 Q525 133 529 149" fill="none"/>
        <rect x="510" y="157" width="46" height="14" rx="7" transform="rotate(-18 533 164)"/>
        <path d="M511 157 Q492 148 490 135 M541 169 Q557 184 554 197" fill="none"/>
        <rect x="465" y="185" width="44" height="14" rx="7" transform="rotate(12 487 192)"/>
        <path d="M465 185 Q450 171 454 159 M500 196 Q515 207 529 203" fill="none"/>
      </g>
    `
  },
  {
    key: "cell",
    label: "분자·유전자",
    match: /유전자|분자|세포|바이러스|감염|면역|염증|종양표지자|마커|유전|암|종양|PCR|DNA|RNA|분자진단|mutation|genetic|molecular|virus|bacteria|infection/i,
    svg: `
      <g fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path d="M285 78 C470 125 285 181 470 230 S285 337 470 402" stroke="#b31e3d" stroke-width="15"/>
        <path d="M470 78 C285 125 470 181 285 230 S470 337 285 402" stroke="#d996a5" stroke-width="15"/>
        <g stroke="#b45b70" stroke-width="5">
          <path d="M330 94 L425 94"/><path d="M300 132 L455 132"/>
          <path d="M330 171 L425 171"/><path d="M333 210 L422 210"/>
          <path d="M335 250 L420 250"/><path d="M301 290 L454 290"/>
          <path d="M334 329 L421 329"/><path d="M370 369 L385 369"/>
        </g>
        <g stroke="#f7dfe5" stroke-width="3">
          <path d="M338 94 L417 94"/><path d="M313 132 L442 132"/>
          <path d="M337 171 L419 171"/><path d="M340 210 L415 210"/>
          <path d="M343 250 L410 250"/><path d="M315 290 L440 290"/>
          <path d="M342 329 L413 329"/><path d="M373 369 L382 369"/>
        </g>
      </g>
    `
  },
  {
    key: "blood",
    label: "혈액",
    match: /혈액|혈구|빈혈|응고|혈소판|백혈구|적혈구|혈당|당뇨|인슐린|대사/i,
    svg: `
      <g>
        <g fill="#c9415a" stroke="#a72a43" stroke-width="5">
          <ellipse cx="269" cy="181" rx="52" ry="29" transform="rotate(-22 269 181)"/><ellipse cx="420" cy="141" rx="48" ry="27" transform="rotate(18 420 141)"/><ellipse cx="534" cy="238" rx="55" ry="30" transform="rotate(-14 534 238)"/><ellipse cx="353" cy="283" rx="49" ry="28" transform="rotate(20 353 283)"/>
        </g>
        <g fill="#eea0ac" opacity=".9">
          <ellipse cx="269" cy="181" rx="29" ry="13" transform="rotate(-22 269 181)"/><ellipse cx="420" cy="141" rx="27" ry="12" transform="rotate(18 420 141)"/><ellipse cx="534" cy="238" rx="31" ry="14" transform="rotate(-14 534 238)"/><ellipse cx="353" cy="283" rx="27" ry="13" transform="rotate(20 353 283)"/>
        </g>
        <g fill="#d5c9ee" stroke="#8f80c0" stroke-width="5"><circle cx="366" cy="209" r="31"/><circle cx="464" cy="322" r="21"/></g>
        <g fill="#f3d179" stroke="#cba447" stroke-width="3"><circle cx="596" cy="150" r="10"/><circle cx="214" cy="274" r="8"/><circle cx="451" cy="194" r="9"/><circle cx="590" cy="319" r="9"/></g>
      </g>
    `
  },
];

function frame(inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="480" viewBox="0 0 800 480">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff8f7"/><stop offset="1" stop-color="#f8e3e5"/></linearGradient>
      <linearGradient id="organ" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#dc7788"/><stop offset=".55" stop-color="#c34b65"/><stop offset="1" stop-color="#97304b"/></linearGradient>
      <radialGradient id="glow"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#f7dfe2" stop-opacity=".08"/></radialGradient>
    </defs>
    <rect width="800" height="480" rx="34" fill="url(#bg)"/>
    <circle cx="105" cy="82" r="116" fill="#fff" opacity=".36"/>
    <circle cx="693" cy="408" r="162" fill="url(#glow)"/>
    <path d="M42 392 C160 349 229 426 347 387 S579 344 758 405" fill="none" stroke="#fff" stroke-width="3" opacity=".68"/>
    <g opacity=".28" fill="#dbaab2"><circle cx="93" cy="350" r="5"/><circle cx="121" cy="367" r="3"/><circle cx="706" cy="111" r="5"/><circle cx="683" cy="91" r="3"/><circle cx="649" cy="373" r="4"/></g>
    ${inner}
  </svg>`;
}

function encodeSvg(svg) {
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

export function createMedicalIllustration(sourceText = "") {
  const text = String(sourceText || "");
  const topic = TOPICS.find((candidate) => candidate.match.test(text)) || {
    key: "clinical",
    label: "검사 안내",
    svg: `
      <g>
        <rect x="88" y="76" width="248" height="324" rx="20" fill="#fff" stroke="#ead5da" stroke-width="5"/>
        <rect x="112" y="103" width="115" height="12" rx="6" fill="#c41230"/>
        <rect x="112" y="129" width="175" height="7" rx="3.5" fill="#d8c2c8"/>
        <rect x="112" y="145" width="151" height="7" rx="3.5" fill="#e4d7db"/>
        <rect x="112" y="184" width="198" height="105" rx="10" fill="#fff5f7" stroke="#f0dce1" stroke-width="3"/>
        <g fill="#c41230">
          <rect x="133" y="240" width="18" height="33" rx="3"/>
          <rect x="164" y="220" width="18" height="53" rx="3"/>
          <rect x="195" y="230" width="18" height="43" rx="3"/>
          <rect x="226" y="203" width="18" height="70" rx="3"/>
          <rect x="257" y="214" width="18" height="59" rx="3"/>
        </g>
        <path d="M127 273 H292" stroke="#a67c87" stroke-width="3"/>
        <rect x="112" y="310" width="198" height="48" rx="7" fill="#fff" stroke="#ead5da" stroke-width="2"/>
        <path d="M126 326 H201 M126 340 H181" stroke="#cdb8bf" stroke-width="5" stroke-linecap="round"/>
        <circle cx="280" cy="334" r="13" fill="#e3f1e9" stroke="#55936e" stroke-width="3"/>
        <path d="M273 334 L278 339 L287 328" fill="none" stroke="#55936e" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
      <g>
        <path d="M444 104 L444 239 Q444 272 475 272 Q506 272 506 239 L506 104" fill="#fff" stroke="#a83b55" stroke-width="6" stroke-linejoin="round"/>
        <path d="M450 198 L450 239 Q450 264 475 264 Q500 264 500 239 L500 198 Z" fill="#c41230" opacity=".88"/>
        <path d="M435 103 H515" stroke="#7f1024" stroke-width="12" stroke-linecap="round"/>
        <path d="M456 220 Q475 231 494 219" fill="none" stroke="#f5b8c3" stroke-width="4"/>
        <rect x="433" y="294" width="85" height="9" rx="4.5" fill="#ead5da"/>
        <rect x="445" y="313" width="61" height="9" rx="4.5" fill="#ead5da"/>
      </g>
      <path d="M352 175 C375 175 395 175 417 175" fill="none" stroke="#c41230" stroke-width="4" stroke-linecap="round"/>
      <path d="M405 165 L418 175 L405 185" fill="none" stroke="#c41230" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    `
  };
  const safeKey = topic.key.replace(/[^a-z0-9-]/gi, "-");
  return {
    id: "medical-auto-" + safeKey,
    name: topic.label + " 개념도(설명용 일러스트)",
    source: "자동 생성 의료 개념도",
    dataUrl: encodeSvg(frame(topic.svg)),
    width: 800,
    height: 480,
    generated: true,
    topicKey: safeKey,
  };
}
