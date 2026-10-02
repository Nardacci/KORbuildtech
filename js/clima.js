/* KORbuild RDO — clima automático pela coordenada da obra (Open-Meteo, gratuito e sem chave).
 * Manhã = 7h às 12h; tarde = 13h às 17h. Chuva acima de 2 mm no turno = impraticável. */

export const TEMPOS = { sol: 'Sol', nublado: 'Nublado', chuva: 'Chuva' };

function classificar(codigos, chuvaMm) {
  if (chuvaMm >= 0.5 || codigos.some((c) => c >= 51)) return 'chuva';
  const medio = codigos.reduce((a, b) => a + b, 0) / Math.max(1, codigos.length);
  return medio >= 2 ? 'nublado' : 'sol';
}

export async function buscarClima(lat, lon, dataIso) {
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
    '&hourly=weather_code,precipitation,temperature_2m&timezone=auto&start_date=' + dataIso + '&end_date=' + dataIso;
  const controle = new AbortController();
  const limite = setTimeout(() => controle.abort(), 8000);
  try {
    const resp = await fetch(url, { signal: controle.signal });
    if (!resp.ok) throw new Error('Open-Meteo respondeu ' + resp.status);
    const j = await resp.json();
    const turno = (de, ate) => {
      const idx = j.hourly.time.map((t, i) => [Number(t.slice(11, 13)), i]).filter(([h]) => h >= de && h <= ate).map(([, i]) => i);
      const codigos = idx.map((i) => j.hourly.weather_code[i]).filter((c) => c != null);
      const chuva = idx.reduce((s, i) => s + (j.hourly.precipitation[i] || 0), 0);
      const temps = idx.map((i) => j.hourly.temperature_2m[i]).filter((t) => t != null);
      return {
        tempo: classificar(codigos, chuva),
        praticavel: chuva < 2,
        chuvaMm: Math.round(chuva * 10) / 10,
        temperatura: temps.length ? Math.round(Math.max(...temps)) : null,
      };
    };
    return { manha: turno(7, 12), tarde: turno(13, 17), fonte: 'automatico' };
  } finally {
    clearTimeout(limite);
  }
}
