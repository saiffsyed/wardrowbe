// The plain figure the dressing room dresses: a women's or men's outline, no face or hair.
export function DressingFigure({ shape, colour, className = '' }: { shape: 'women' | 'men'; colour: string; className?: string }) {
  const women = shape === 'women';
  const torso = women ? 'M66 80Q100 72 134 80L126 148Q120 162 134 206H66Q80 162 74 148Z' : 'M56 80Q100 72 144 80L134 206H66Z';
  const left = women ? 'M68 84L50 202L59 204L78 112Z' : 'M58 84L40 202L50 204L70 112Z';
  const right = women ? 'M132 84L150 202L141 204L122 112Z' : 'M142 84L160 202L150 204L130 112Z';
  return (
    <svg viewBox="0 0 200 400" preserveAspectRatio="xMidYMid meet" aria-hidden="true" className={className}>
      <g fill={colour}>
        <ellipse cx="100" cy="36" rx="20" ry="25" />
        <rect x="91" y="56" width="18" height="20" />
        <path d={torso} />
        <path d={left} />
        <path d={right} />
        <path d="M66 204H134L124 384H106L100 232L94 384H76Z" />
        <ellipse cx="86" cy="388" rx="14" ry="6" />
        <ellipse cx="114" cy="388" rx="14" ry="6" />
      </g>
    </svg>
  );
}
