function MansionIllustration() {
  return (
    <div className="mansion-frame">
      <svg
        aria-label="Malhotra Mansion at night, the scene of the fictional case"
        className="mansion-art"
        role="img"
        viewBox="0 0 760 620"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="night-sky" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#111921" />
            <stop offset="1" stopColor="#202b2e" />
          </linearGradient>
          <linearGradient id="ground" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#28312f" />
            <stop offset="1" stopColor="#101719" />
          </linearGradient>
          <linearGradient id="window-light" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#d7a85c" stopOpacity=".86" />
            <stop offset="1" stopColor="#8b5d36" stopOpacity=".58" />
          </linearGradient>
          <pattern id="rain-lines" width="44" height="44" patternTransform="rotate(15)" patternUnits="userSpaceOnUse">
            <path d="M0 0V16" stroke="#d9d3c5" strokeOpacity=".08" strokeWidth="1" />
          </pattern>
        </defs>

        <rect fill="url(#night-sky)" height="620" width="760" />
        <rect fill="url(#rain-lines)" height="620" width="760" />
        <circle cx="595" cy="106" fill="#d4c8a9" opacity=".85" r="35" />
        <circle cx="608" cy="95" fill="#111921" opacity=".92" r="31" />
        <g fill="#e4dcc7" opacity=".5">
          <circle cx="98" cy="99" r="1.7" />
          <circle cx="192" cy="148" r="1.3" />
          <circle cx="306" cy="77" r="1.5" />
          <circle cx="458" cy="122" r="1.2" />
          <circle cx="685" cy="202" r="1.5" />
          <circle cx="532" cy="54" r="1.2" />
        </g>

        <path d="M0 372 100 314 176 359 276 292 373 355 472 303 569 352 664 285 760 343V470H0Z" fill="#182326" />
        <path d="M0 410 111 361 203 407 301 349 404 408 493 355 600 406 697 350 760 381V500H0Z" fill="#202a29" />
        <path d="M0 443C161 414 240 448 376 420s244-4 384-29V620H0Z" fill="url(#ground)" />

        <g fill="#131b1d">
          <path d="M75 375V289h9v-22h8v22h9v89Zm-17 20c9-16 21-24 39-24s31 8 40 24v8H58Zm514-28V265h11v-24h8v24h11v102Zm-21 23c9-16 21-24 37-24s29 8 38 24v8h-75Z" />
          <path d="M0 398c11-22 24-33 42-34 17-1 30 10 39 34v22H0Zm673-2c12-23 26-34 45-34s31 13 42 37v22H673Z" />
        </g>

        <g className="mansion-building">
          <path d="M204 360V249l91-78 90 78v111Z" fill="#222a28" />
          <path d="m186 255 109-96 109 96h-31l-78-68-78 68Z" fill="#11191b" />
          <path d="M183 255h223v15H183Z" fill="#303532" />
          <path d="M219 360v-88h152v88Z" fill="#28302d" />
          <path d="m209 275 84-66 87 66H209Z" fill="#151d1e" />
          <path d="M292 164h9v-28h-9z" fill="#202827" />
          <path d="M300 136h28v6h-28z" fill="#343936" />

          <path d="M109 366V282l73-56 77 56v84Z" fill="#1e2726" />
          <path d="m96 286 87-73 90 73h-26l-64-52-63 52Z" fill="#11191b" />
          <path d="M98 286h174v12H98Z" fill="#343a35" />
          <path d="M125 366v-66h112v66Z" fill="#29312e" />

          <path d="M402 366V282l72-56 77 56v84Z" fill="#1e2726" />
          <path d="m390 286 86-73 90 73h-26l-64-52-63 52Z" fill="#11191b" />
          <path d="M392 286h174v12H392Z" fill="#343a35" />
          <path d="M419 366v-66h112v66Z" fill="#29312e" />

          <g fill="url(#window-light)" stroke="#151c1c" strokeWidth="5">
            <path d="M239 223h25v31h-25z" />
            <path d="M331 223h25v31h-25z" />
            <path d="M143 297h23v32h-23z" />
            <path d="M202 297h23v32h-23z" />
            <path d="M435 297h23v32h-23z" />
            <path d="M494 297h23v32h-23z" />
            <path d="M275 281h58v79h-58z" />
          </g>
          <g stroke="#202623" strokeWidth="3">
            <path d="M251 223v31m92-31v31m-188 43v32m59-32v32m233-32v32m59-32v32M304 281v79m-29-42h58" />
          </g>
          <path d="M267 365v-10h76v10Z" fill="#93815d" />
          <path d="M283 360v-52a21 21 0 0 1 42 0v52Z" fill="#151c1d" />
          <path d="M292 361v-50a12 12 0 0 1 24 0v50Z" fill="#624a32" />
          <circle cx="312" cy="334" fill="#d7ad68" r="2.5" />
        </g>

        <path d="M0 506c124-26 221-11 361-31s263-19 399 2" fill="none" stroke="#606254" strokeOpacity=".28" strokeWidth="2" />
        <path d="M308 364 257 620h239L326 364Z" fill="#35392f" opacity=".68" />
        <path d="m307 364-66 256m87-256 63 256" fill="none" stroke="#73715d" strokeOpacity=".35" strokeWidth="2" />
        <g fill="#182120">
          <path d="m69 468 14-69 15 69Zm-9 10h48v8H60Zm541-11 17-77 16 77Zm-9 10h51v8h-51Z" />
          <path d="M0 513h170v21H0zm588 2h172v23H588z" opacity=".7" />
        </g>
        <rect fill="#100f0d" height="620" opacity=".12" width="760" />
      </svg>
      <div className="scene-vignette" aria-hidden="true" />
      <div className="scene-caption">
        <span className="scene-caption-label">LOCATION ON RECORD</span>
        <span className="scene-caption-name">Malhotra Mansion</span>
      </div>
      <div className="scene-index" aria-hidden="true">01 <span /> NIGHT OF INCIDENT</div>
    </div>
  )
}

export default MansionIllustration
