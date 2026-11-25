import * as THREE from 'three';

export interface ProceduralTextureSet {
  concreteMap: THREE.CanvasTexture;
  concreteCorrodedMap: THREE.CanvasTexture;
  concreteBump: THREE.CanvasTexture;
  gfrpMap: THREE.CanvasTexture;
  gfrpBump: THREE.CanvasTexture;
  cfrpMap: THREE.CanvasTexture;
  cfrpBump: THREE.CanvasTexture;
  epoxyMap: THREE.CanvasTexture;
  primerMap: THREE.CanvasTexture;
  steelMap: THREE.CanvasTexture;
  platenTopMap: THREE.CanvasTexture;
  contactShadowMap: THREE.CanvasTexture;
  dispose: () => void;
}

function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function configureTexture(
  canvas: HTMLCanvasElement,
  isColor: boolean,
  maxAnisotropy: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = Math.max(1, maxAnisotropy);
  if (isColor) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.needsUpdate = true;
  return tex;
}

/**
 * Tạo bề mặt bê tông B25 mài tạo nhám lộ cốt liệu (đá dăm, cát vàng, lỗ rỗ bề mặt)
 */
function drawConcreteTextures(corroded: boolean): {
  albedo: HTMLCanvasElement;
  bump: HTMLCanvasElement;
} {
  const size = 512;
  const albedo = document.createElement('canvas');
  albedo.width = size;
  albedo.height = size;
  const ctx = albedo.getContext('2d')!;

  const bump = document.createElement('canvas');
  bump.width = size;
  bump.height = size;
  const bCtx = bump.getContext('2d')!;

  const rand = seededRandom(corroded ? 9182 : 4219);

  // Nền hồ xi măng B25
  ctx.fillStyle = corroded ? '#7c7668' : '#7b8085';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  // Nhiễu hạt cát mịn và vệt mài
  for (let i = 0; i < 6500; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 0.6 + rand() * 1.8;
    const shade = Math.floor(105 + rand() * 55);
    ctx.fillStyle = corroded
      ? `rgb(${shade + 12}, ${shade + 4}, ${shade - 12})`
      : `rgb(${shade}, ${shade + 2}, ${shade + 4})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    const bShade = Math.floor(110 + rand() * 60);
    bCtx.fillStyle = `rgb(${bShade},${bShade},${bShade})`;
    bCtx.fillRect(x, y, r + 1, r + 1);
  }

  // Cốt liệu lớn lộ ra sau khi mài tạo nhám (đá dăm xám đen, đá thạch anh, sỏi vàng nhạt)
  for (let i = 0; i < 360; i++) {
    const cx = rand() * size;
    const cy = rand() * size;
    const radius = 3 + rand() * 9;
    const sides = 5 + Math.floor(rand() * 3);
    const rot = rand() * Math.PI * 2;
    const type = rand();

    let fill = '#52575e';
    if (type < 0.35) fill = '#474c54'; // đá bazan sẫm
    else if (type < 0.68) fill = '#9ca1a6'; // đá vôi sáng
    else if (type < 0.88) fill = '#a1927a'; // sỏi sông vàng xám
    else fill = '#63686f';

    const drawPoly = (target: CanvasRenderingContext2D, color: string) => {
      target.fillStyle = color;
      target.beginPath();
      for (let s = 0; s < sides; s++) {
        const ang = rot + (s / sides) * Math.PI * 2;
        const rad = radius * (0.72 + rand() * 0.48);
        const px = cx + Math.cos(ang) * rad;
        const py = cy + Math.sin(ang) * rad;
        if (s === 0) target.moveTo(px, py);
        else target.lineTo(px, py);
      }
      target.closePath();
      target.fill();
    };

    drawPoly(ctx, fill);
    const bVal = Math.floor(165 + rand() * 75);
    drawPoly(bCtx, `rgb(${bVal},${bVal},${bVal})`);
  }

  // Lỗ rỗ khí bề mặt bê tông
  for (let i = 0; i < 190; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 1 + rand() * 2.4;
    ctx.fillStyle = 'rgba(28, 32, 38, 0.72)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    bCtx.fillStyle = '#181818';
    bCtx.beginPath();
    bCtx.arc(x, y, r, 0, Math.PI * 2);
    bCtx.fill();
  }

  // Vệt xước mài tạo nhám theo chu vi
  ctx.strokeStyle = 'rgba(220, 226, 232, 0.14)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 70; i++) {
    const y = rand() * size;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y + (rand() - 0.5) * 8);
    ctx.stroke();
  }

  // Vệt ăn mòn muối Cl⁻ / kiềm trắng loang + rỉ bề mặt cho M0 ở chế độ xâm thực
  if (corroded) {
    for (let i = 0; i < 95; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const rad = 10 + rand() * 28;
      const grad = ctx.createRadialGradient(x, y, 1, x, y, rad);
      if (i % 3 === 0) {
        grad.addColorStop(0, 'rgba(228, 235, 240, 0.52)'); // kết tinh muối NaCl
        grad.addColorStop(1, 'rgba(228, 235, 240, 0)');
      } else {
        grad.addColorStop(0, 'rgba(138, 86, 46, 0.42)'); // ố kiềm & rỉ bề mặt
        grad.addColorStop(1, 'rgba(138, 86, 46, 0)');
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return { albedo, bump };
}

/**
 * Tạo vân dệt sợi đơn hướng 90° (phương ngang theo chu vi trụ) cho GFRP hoặc CFRP
 */
function drawFrpWeaveTextures(type: 'GFRP' | 'CFRP'): {
  albedo: HTMLCanvasElement;
  bump: HTMLCanvasElement;
} {
  const size = 512;
  const albedo = document.createElement('canvas');
  albedo.width = size;
  albedo.height = size;
  const ctx = albedo.getContext('2d')!;

  const bump = document.createElement('canvas');
  bump.width = size;
  bump.height = size;
  const bCtx = bump.getContext('2d')!;

  const isCarbon = type === 'CFRP';

  // Nền keo thấm giữa các bó sợi
  ctx.fillStyle = isCarbon ? '#14171c' : '#cdecf4';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#5a5a5a';
  bCtx.fillRect(0, 0, size, size);

  // Các bó sợi đơn hướng chạy ngang (90° so với trục nén đứng)
  const towCount = 48;
  const towH = size / towCount;

  for (let i = 0; i < towCount; i++) {
    const y = i * towH;
    // Gradient ngang tạo độ phồng 3D của từng bó sợi
    const grad = ctx.createLinearGradient(0, y, 0, y + towH);
    const bGrad = bCtx.createLinearGradient(0, y, 0, y + towH);

    if (isCarbon) {
      const alt = i % 2 === 0 ? 1 : 0.85;
      grad.addColorStop(0, '#050608');
      grad.addColorStop(0.28, `rgb(${Math.round(20 * alt)}, ${Math.round(23 * alt)}, ${Math.round(28 * alt)})`);
      grad.addColorStop(0.5, `rgb(${Math.round(32 * alt)}, ${Math.round(36 * alt)}, ${Math.round(42 * alt)})`);
      grad.addColorStop(0.75, `rgb(${Math.round(17 * alt)}, ${Math.round(20 * alt)}, ${Math.round(25 * alt)})`);
      grad.addColorStop(1, '#040507');
    } else {
      grad.addColorStop(0, '#a6d8e6');
      grad.addColorStop(0.3, '#e8f7fb');
      grad.addColorStop(0.5, '#f4fcff');
      grad.addColorStop(0.75, '#d5eff7');
      grad.addColorStop(1, '#9fd3e2');
    }

    ctx.fillStyle = grad;
    ctx.fillRect(0, y, size, towH);

    bGrad.addColorStop(0, '#444444');
    bGrad.addColorStop(0.5, '#f0f0f0');
    bGrad.addColorStop(1, '#444444');
    bCtx.fillStyle = bGrad;
    bCtx.fillRect(0, y, size, towH);

    // Sợi tơ siêu mịn dọc theo bó sợi ngang
    ctx.strokeStyle = isCarbon ? 'rgba(130, 145, 165, 0.14)' : 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 0.7;
    for (let f = 1; f <= 3; f++) {
      const fy = y + (towH * f) / 4;
      ctx.beginPath();
      ctx.moveTo(0, fy);
      ctx.lineTo(size, fy);
      ctx.stroke();
    }
  }

  // Chỉ định vị ngang (weft tracer threads chạy đứng vuông góc giữ các bó sợi)
  const stitchCols = 8;
  for (let c = 0; c < stitchCols; c++) {
    const x = (c + 0.5) * (size / stitchCols);
    ctx.strokeStyle = isCarbon ? 'rgba(148, 163, 184, 0.24)' : 'rgba(56, 189, 248, 0.38)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();

    bCtx.strokeStyle = '#d8d8d8';
    bCtx.lineWidth = 2;
    bCtx.setLineDash([6, 4]);
    bCtx.beginPath();
    bCtx.moveTo(x, 0);
    bCtx.lineTo(x, size);
    bCtx.stroke();
  }
  ctx.setLineDash([]);
  bCtx.setLineDash([]);

  return { albedo, bump };
}

function drawEpoxyTexture(amberPrimer: boolean): HTMLCanvasElement {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRandom(amberPrimer ? 111 : 222);

  ctx.fillStyle = amberPrimer ? '#d97706' : '#9aa3ad';
  ctx.fillRect(0, 0, size, size);

  // Vệt bay trát keo Sikadur-330 hoặc vệt cọ Primer
  for (let i = 0; i < 180; i++) {
    const y = rand() * size;
    ctx.strokeStyle = amberPrimer
      ? `rgba(251, 191, 36, ${0.12 + rand() * 0.14})`
      : `rgba(226, 232, 240, ${0.08 + rand() * 0.12})`;
    ctx.lineWidth = 1 + rand() * 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y + (rand() - 0.5) * 6);
    ctx.stroke();
  }
  return canvas;
}

function drawBrushedSteelTexture(withTargetRing: boolean): HTMLCanvasElement {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRandom(777);

  ctx.fillStyle = '#475569';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 600; i++) {
    const y = rand() * size;
    const alpha = 0.04 + rand() * 0.08;
    ctx.strokeStyle = rand() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(15,23,42,${alpha})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }

  if (withTargetRing) {
    const cx = size / 2;
    const cy = size / 2;
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.35)';
    ctx.lineWidth = 2;
    [size * 0.22, size * 0.34, size * 0.44].forEach((r) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.moveTo(cx - size * 0.46, cy);
    ctx.lineTo(cx + size * 0.46, cy);
    ctx.moveTo(cx, cy - size * 0.46);
    ctx.lineTo(cx, cy + size * 0.46);
    ctx.stroke();
  }

  return canvas;
}

function drawContactShadowTexture(): HTMLCanvasElement {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.08,
    size / 2,
    size / 2,
    size * 0.5,
  );
  grad.addColorStop(0, 'rgba(2, 6, 14, 0.72)');
  grad.addColorStop(0.55, 'rgba(2, 6, 14, 0.32)');
  grad.addColorStop(1, 'rgba(2, 6, 14, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextureSet {
  const cleanConc = drawConcreteTextures(false);
  const corrConc = drawConcreteTextures(true);
  const gfrp = drawFrpWeaveTextures('GFRP');
  const cfrp = drawFrpWeaveTextures('CFRP');
  const epoxyCanvas = drawEpoxyTexture(false);
  const primerCanvas = drawEpoxyTexture(true);
  const steelCanvas = drawBrushedSteelTexture(false);
  const platenTopCanvas = drawBrushedSteelTexture(true);
  const shadowCanvas = drawContactShadowTexture();

  const concreteMap = configureTexture(cleanConc.albedo, true, maxAnisotropy, 2, 2);
  const concreteCorrodedMap = configureTexture(corrConc.albedo, true, maxAnisotropy, 2, 2);
  const concreteBump = configureTexture(cleanConc.bump, false, maxAnisotropy, 2, 2);

  const gfrpMap = configureTexture(gfrp.albedo, true, maxAnisotropy, 2, 2);
  const gfrpBump = configureTexture(gfrp.bump, false, maxAnisotropy, 2, 2);

  const cfrpMap = configureTexture(cfrp.albedo, true, maxAnisotropy, 2, 2);
  const cfrpBump = configureTexture(cfrp.bump, false, maxAnisotropy, 2, 2);

  const epoxyMap = configureTexture(epoxyCanvas, true, maxAnisotropy, 2, 2);
  const primerMap = configureTexture(primerCanvas, true, maxAnisotropy, 2, 2);
  const steelMap = configureTexture(steelCanvas, true, maxAnisotropy, 2, 1);
  const platenTopMap = configureTexture(platenTopCanvas, true, maxAnisotropy, 1, 1);
  const contactShadowMap = configureTexture(shadowCanvas, true, maxAnisotropy, 1, 1);

  return {
    concreteMap,
    concreteCorrodedMap,
    concreteBump,
    gfrpMap,
    gfrpBump,
    cfrpMap,
    cfrpBump,
    epoxyMap,
    primerMap,
    steelMap,
    platenTopMap,
    contactShadowMap,
    dispose: () => {
      [
        concreteMap,
        concreteCorrodedMap,
        concreteBump,
        gfrpMap,
        gfrpBump,
        cfrpMap,
        cfrpBump,
        epoxyMap,
        primerMap,
        steelMap,
        platenTopMap,
        contactShadowMap,
      ].forEach((t) => t.dispose());
    },
  };
}
