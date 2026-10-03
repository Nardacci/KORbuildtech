"""Gera o jogo de plantas de exemplo do KORbuild Measure: um PDF vetorial de 3 folhas (sem dependências).

Casa modelo de 40'-0" x 28'-0", telhado de duas águas 6/12, folha tabloide (17" x 11"):
  A-101  First floor plan   1/4" = 1'-0"  (18 points por pé)
  A-201  Elevations         1/4" = 1'-0"  (fachadas sul e leste: siding, janelas, porta, empena)
  A-301  Section A          3/8" = 1'-0"  (27 points por pé: outra escala de propósito)
Uso: python3 tools/gerar-planta.py  →  assets/plantas/casa-modelo.pdf
"""
import math

W, H = 1224, 792        # folha tabloide deitada
PT_PE, X0, Y0 = 18.0, 110.0, 190.0
c = []                  # comandos da página atual

def origem(pt_pe, x0, y0):
    global PT_PE, X0, Y0
    PT_PE, X0, Y0 = pt_pe, x0, y0
def px(x): return X0 + x * PT_PE
def py(y): return Y0 + y * PT_PE
def esc(t): return t.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')
def linha(x1, y1, x2, y2, lw=0.6):
    c.append('%.2f w %.2f %.2f m %.2f %.2f l S' % (lw, x1, y1, x2, y2))
def lp(x1, y1, x2, y2, lw=0.6):  # linha em pés
    linha(px(x1), py(y1), px(x2), py(y2), lw)
def poligono(pts, lw=1.0, preencher=None):  # em pés
    c.append(('%s ' % preencher if preencher else '') + '%.2f w ' % lw + '%.2f %.2f m ' % (px(pts[0][0]), py(pts[0][1])) + ' '.join('%.2f %.2f l' % (px(a), py(b)) for a, b in pts[1:]) + (' h B 0 g' if preencher else ' h S'))
def ret(x1, y1, x2, y2, lw=1.0, preencher=None):
    poligono([(x1, y1), (x2, y1), (x2, y2), (x1, y2)], lw, preencher)
def parede(x1, y1, x2, y2, esp):  # em pés, linha grossa centrada (espessura em pés)
    c.append('0 J %.2f w %.2f %.2f m %.2f %.2f l S' % (esp * PT_PE, px(x1), py(y1), px(x2), py(y2)))
def texto(x, y, t, tam=9, fonte='F1', rot=0, centro=False):
    larg = len(t) * tam * 0.5 if centro else 0
    if rot:
        c.append('BT /%s %.1f Tf 0 1 -1 0 %.2f %.2f Tm (%s) Tj ET' % (fonte, tam, x, y - larg, esc(t)))
    else:
        c.append('BT /%s %.1f Tf %.2f %.2f Td (%s) Tj ET' % (fonte, tam, x - larg, y, esc(t)))
def arco_porta(cx, cy, r, a0, a1):
    pts = [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / 12)), cy + r * math.sin(math.radians(a0 + (a1 - a0) * i / 12))) for i in range(13)]
    c.append('0.4 w [2 2] 0 d %.2f %.2f m ' % (px(pts[0][0]), py(pts[0][1])) + ' '.join('%.2f %.2f l' % (px(a), py(b)) for a, b in pts[1:]) + ' S [] 0 d')
    linha(px(cx), py(cy), px(cx + r * math.cos(math.radians(a1))), py(cy + r * math.sin(math.radians(a1))), 0.6)
def cota(x1, y1, x2, y2, t, lado=1):  # cota com linha, marcas a 45° e texto (pés)
    a, b, cc, d = px(x1), py(y1), px(x2), py(y2)
    linha(a, b, cc, d, 0.4)
    for (u, v) in ((a, b), (cc, d)):
        linha(u - 4, v - 4, u + 4, v + 4, 0.8)
    if y1 == y2: texto((a + cc) / 2, b + 4 * lado, t, 9, centro=True)
    else: texto(a - 4 if lado > 0 else a + 12, (b + d) / 2, t, 9, rot=1, centro=True)

def carimbo(titulo, escala, folha, extras=()):
    c.append('1 w 24 24 %d %d re S' % (W - 48, H - 48))
    c.append('1 w 940 24 260 %d re S' % (H - 48))
    for (y, t, tam, f) in ((730, 'KORbuild', 16, 'F2'), (712, 'Planta de exemplo', 9, 'F1'), (640, 'CASA MODELO', 14, 'F2'), (622, '1450 Elm St, Manchester, NH', 9, 'F1'),
                           (560, titulo, 13, 'F2'), (540, 'SCALE: ' + escala, 10, 'F1'), (120, 'SHEET', 8, 'F1'), (90, folha, 28, 'F2'), (50, 'Prototipo - planta ficticia', 8, 'F1')):
        texto(956, y, t, tam, f)
    for (y, t, tam, f) in extras: texto(956, y, t, tam, f)
    # escala gráfica (0, 2, 4, 8 pés) na escala da folha
    for i, (a, b) in enumerate(((0, 2), (2, 4), (4, 8))):
        if i % 2 == 0: c.append('0 g %.2f 500 %.2f 6 re f' % (956 + a * PT_PE, (b - a) * PT_PE))
    c.append('0 g 0.6 w 956 500 %.2f 6 re S' % (8 * PT_PE))
    for v in (0, 2, 4, 8): texto(956 + v * PT_PE - 2, 488, str(v) + "'", 7)
    texto(956, 474, 'GRAPHIC SCALE', 7, 'F2')

QUADRO_VAOS = ((440, 'WINDOW / DOOR SCHEDULE', 8, 'F2'), (426, 'W1  5\'-0" x 4\'-0"  (sill 3\'-0")', 8, 'F1'),
               (414, 'W2  4\'-0" x 4\'-0"  (sill 3\'-0")', 8, 'F1'), (402, 'D1  3\'-0" x 6\'-8"  (entry door)', 8, 'F1'))

# ---------------- A-101 · First floor plan (1/4" = 1'-0") ----------------
def folha_planta():
    origem(18.0, 110.0, 190.0)
    E, I = 0.5, 0.375   # paredes: externa 6", interna 4 1/2"
    h = E / 2
    def janela(x1, y1, x2, y2):  # vão branco na parede externa com três linhas finas
        if y1 == y2: c.append('1 g %.2f %.2f %.2f %.2f re f 0 g' % (px(x1), py(y1 - E / 2), (x2 - x1) * PT_PE, E * PT_PE))
        else: c.append('1 g %.2f %.2f %.2f %.2f re f 0 g' % (px(x1 - E / 2), py(y1), E * PT_PE, (y2 - y1) * PT_PE))
        for d in (-0.2, 0, 0.2):
            if y1 == y2: linha(px(x1), py(y1 + d), px(x2), py(y2 + d), 0.4)
            else: linha(px(x1 + d), py(y1), px(x2 + d), py(y2), 0.4)
    parede(0, h, 8, h, E); parede(11, h, 40, h, E)                    # sul (porta de entrada 8'-11')
    parede(40 - h, 0, 40 - h, 28, E)                                  # leste
    parede(0, 28 - h, 40, 28 - h, E)                                  # norte
    parede(h, 0, h, 28, E)                                            # oeste
    parede(22, E, 22, 7, I); parede(22, 10, 22, 28 - E, I)
    parede(E, 16, 6, 16, I); parede(14, 16, 22, 16, I)
    parede(22, 12, 26, 12, I); parede(29, 12, 40 - E, 12, I)
    parede(22, 18, 31, 18, I); parede(34, 18, 40 - E, 18, I)
    parede(30, 12, 30, 18, I)
    arco_porta(8, h, 3, 0, 90); arco_porta(22, 7, 3, 90, 0); arco_porta(26, 12, 3, 0, 90); arco_porta(31, 18, 3, 0, 90)
    janela(14, h, 19, h); janela(30, h, 35, h); janela(30, 28 - h, 35, 28 - h); janela(6, 28 - h, 10, 28 - h); janela(h, 6, h, 11); janela(40 - h, 4, 40 - h, 8)
    for (x, y, t) in ((16.5, -1.6, 'W1'), (32.5, -1.6, 'W1'), (9.5, -1.6, 'D1'), (41.3, 5.6, 'W2'), (32.5, 28.8, 'W1'), (8, 28.8, 'W2'), (-1.4, 8.2, 'W1')):
        texto(px(x), py(y), t, 7, 'F2', centro=True)
    for (x, y, t) in ((11, 8, 'LIVING ROOM'), (11, 22, 'KITCHEN / DINING'), (31, 6, 'BEDROOM 1'), (26, 15, 'BATH'), (35, 15, 'CLOSET'), (31, 23, 'BEDROOM 2')):
        texto(px(x), py(y), t, 8, 'F2', centro=True)
    cota(0, 31, 40, 31, "40'-0\"")
    cota(-3, 0, -3, 28, "28'-0\"")
    cota(0, -3, 22, -3, "22'-0\"", -1); cota(22, -3, 40, -3, "18'-0\"", -1)
    for (u, v, t) in ((0, 12, "12'-0\""), (12, 18, "6'-0\""), (18, 28, "10'-0\"")):
        cota(43, u, 43, v, t, -1)
    texto(px(20), py(-4.9), 'A', 10, 'F2', centro=True); lp(20, -4.4, 20, 32.4, 0.4); texto(px(20), py(32.6), 'A', 10, 'F2', centro=True)
    carimbo('FIRST FLOOR PLAN', '1/4" = 1\'-0"', 'A-101', QUADRO_VAOS)
    c.append('0.8 w 1100 470 m 1110 500 l 1120 470 l h S'); texto(1106, 506, 'N', 10, 'F2')

# ---------------- A-201 · Elevations (1/4" = 1'-0") ----------------
def siding(x1, x2, y1, y2):  # linhas horizontais finas do lap siding (a cada 8")
    y = y1 + 0.667
    while y < y2 - 0.1:
        c.append('0.6 G'); lp(x1, y, x2, y, 0.25); c.append('0 G')
        y += 0.667
def janela_elev(x1, y1, x2, y2, nome):
    ret(x1, y1, x2, y2, 0.9, '1 g'); ret(x1 + 0.25, y1 + 0.25, x2 - 0.25, y2 - 0.25, 0.4)
    lp((x1 + x2) / 2, y1 + 0.25, (x1 + x2) / 2, y2 - 0.25, 0.4)
    texto(px((x1 + x2) / 2), py(y1) - 12, nome, 7, 'F2', centro=True)

def folha_fachadas():
    # Fachada sul: 40' de largura, beiral a 9'-0", cumeeira a 16'-0" (telhado 6/12 visto de frente)
    origem(18.0, 110.0, 470.0)
    ret(0, 0, 40, 9, 1.2); siding(0, 40, 0, 9)
    poligono([(-1, 8.5), (41, 8.5), (41, 9.2), (40, 9.2), (40, 16), (0, 16), (0, 9.2), (-1, 9.2)], 1.0)
    yy = 9.7
    while yy < 15.9:  # fiadas de telha
        c.append('0.6 G'); lp(0, yy, 40, yy, 0.25); c.append('0 G'); yy += 0.6
    texto(px(20), py(12.5), 'ASPHALT SHINGLES', 7, 'F2', centro=True)
    janela_elev(14, 3, 19, 7, 'W1'); janela_elev(30, 3, 35, 7, 'W1')
    ret(8, 0, 11, 6.667, 0.9, '1 g'); ret(8.3, 0.3, 10.7, 6.367, 0.4); texto(px(9.5), py(6.667) + 4, 'D1', 7, 'F2', centro=True)
    lp(-3, 0, 43, 0, 1.6); texto(px(-2.8), py(0) + 3, 'GRADE', 6)
    cota(0, -2.5, 40, -2.5, "40'-0\"", -1)
    cota(-2, 0, -2, 9, "9'-0\""); cota(42, 0, 42, 16, "16'-0\"", -1)
    texto(px(20), py(-4.0), 'SOUTH ELEVATION   1/4" = 1\'-0"', 9, 'F2', centro=True)
    # Fachada leste: 28' de largura com a empena (triângulo até 16'-0")
    origem(18.0, 110.0, 90.0)
    poligono([(0, 0), (28, 0), (28, 9), (14, 16), (0, 9)], 1.2); siding(0, 28, 0, 9)
    y = 9.667
    while y < 15.6:  # siding também na empena
        meio = (16 - y) * 2
        c.append('0.6 G'); lp(14 - meio, y, 14 + meio, y, 0.25); c.append('0 G'); y += 0.667
    lp(-1, 8.5, 14, 16.5, 1.0); lp(14, 16.5, 29, 8.5, 1.0)
    janela_elev(4, 3, 8, 7, 'W2')
    lp(-3, 0, 31, 0, 1.6)
    cota(0, -2.5, 28, -2.5, "28'-0\"", -1)
    cota(-2, 0, -2, 9, "9'-0\""); cota(30, 0, 30, 16, "16'-0\"", -1)
    texto(px(33), py(4), 'EAST ELEVATION', 9, 'F2'); texto(px(33), py(3), '1/4" = 1\'-0"', 8)
    texto(px(33), py(1.6), 'North and west elevations:', 7); texto(px(33), py(1), 'similar (not shown)', 7)
    origem(18.0, 110.0, 470.0)
    carimbo('ELEVATIONS', '1/4" = 1\'-0"', 'A-201', QUADRO_VAOS + ((380, 'SIDING: VINYL LAP, 4" EXPOSURE', 8, 'F1'),))

# ---------------- A-301 · Section A (3/8" = 1'-0") ----------------
def folha_corte():
    origem(27.0, 150.0, 240.0)
    lp(-3, 0, 29, 0, 1.6); texto(px(-2.8), py(0) + 3, 'GRADE', 6)
    # fundação: frost wall de 8" até 4'-0" abaixo do terreno, sapata de 16" x 8"
    for x in (0, 27.333):
        ret(x, -4, x + 0.667, 0.333, 1.0, '0.85 g')
        ret(x - 0.333, -4.667, x + 1.0, -4, 1.0, '0.85 g')
    ret(0.667, 0, 27.333, 0.333, 1.0, '0.85 g'); texto(px(14), py(0.333) + 4, '4" CONCRETE SLAB', 7, 'F2', centro=True)
    # paredes 2x6 (6") até 9'-0", forro
    for x in (0.083, 27.417):
        ret(x, 0.333, x + 0.5, 9, 1.0)
    lp(0.583, 8.833, 27.417, 8.833, 0.8); texto(px(14), py(8.833) - 12, '1/2" GYP. BD. CEILING', 7, centro=True)
    # telhado 6/12: cumeeira a 16'-0" (subida de 7'-0" em 14'-0"), beiral de 1'-0"
    poligono([(-1, 8.5), (14, 16), (29, 8.5), (29, 8.9), (14, 16.4), (-1, 8.9)], 1.0)
    lp(0, 9, 28, 9, 0.6)  # linha do forro/tesoura
    # símbolo da inclinação
    lp(20, 13, 22.4, 13, 0.6); lp(22.4, 13, 22.4, 11.8, 0.6); texto(px(21.2), py(13) + 3, '12', 7, centro=True); texto(px(22.6), py(12.2), '6', 7)
    for (x, y, t) in ((1.3, 5, '2x6 @ 16" O.C.'), (1.3, 4.4, 'R-21 BATT'), (1.3, 3.8, '1/2" GYP. BD.'), (1.3, -2, '8" FROST WALL'), (1.3, -2.6, '4\'-0" MIN. BELOW GRADE'), (16, 14.2, 'ASPHALT SHINGLES ON 7/16" OSB')):
        texto(px(x), py(y), t, 7, 'F1')
    cota(0, -6, 28, -6, "28'-0\"", -1)
    cota(-1.5, 0.333, -1.5, 9, "8'-8\"")
    cota(-3, -4, -3, 0, "4'-0\"")
    cota(-3, 0, -3, 16, "16'-0\"")
    texto(px(14), py(-7.6), 'SECTION A   3/8" = 1\'-0"', 9, 'F2', centro=True)
    carimbo('SECTION A', '3/8" = 1\'-0"', 'A-301', ((440, 'NEW ENGLAND: FROST WALL', 8, 'F2'), (428, '4\'-0" MIN. (CONFIRM WITH LOCAL CODE)', 8, 'F1')))

paginas = []
for f in (folha_planta, folha_fachadas, folha_corte):
    c = []
    f()
    paginas.append('\n'.join(c).encode('latin-1'))

# Objetos: 1 catálogo, 2 páginas, 3-4 fontes, depois (página, conteúdo) para cada folha
objs = [b'', b'', b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>']
kids = []
for conteudo in paginas:
    n = len(objs) + 1
    kids.append(n)
    objs.append(b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %d %d] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents %d 0 R >>' % (W, H, n + 1))
    objs.append(b'<< /Length %d >>\nstream\n' % len(conteudo) + conteudo + b'\nendstream')
objs[0] = b'<< /Type /Catalog /Pages 2 0 R >>'
objs[1] = b'<< /Type /Pages /Kids [' + b' '.join(b'%d 0 R' % k for k in kids) + b'] /Count %d >>' % len(kids)
saida = bytearray(b'%PDF-1.4\n%\xe2\xe3\xcf\xd3\n')
offs = []
for i, o in enumerate(objs, 1):
    offs.append(len(saida))
    saida += b'%d 0 obj\n' % i + o + b'\nendobj\n'
xref = len(saida)
saida += b'xref\n0 %d\n0000000000 65535 f \n' % (len(objs) + 1) + b''.join(b'%010d 00000 n \n' % o for o in offs)
saida += b'trailer\n<< /Size %d /Root 1 0 R /Info << /Title (Casa modelo - A-101, A-201, A-301) /Producer (KORbuild) >> >>\nstartxref\n%d\n%%%%EOF\n' % (len(objs) + 1, xref)
open('assets/plantas/casa-modelo.pdf', 'wb').write(saida)
print('ok', len(saida), 'bytes,', len(paginas), 'folhas')
