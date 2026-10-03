"""Gera a planta de exemplo do KORbuild Measure: um PDF vetorial (sem dependências).

Casa modelo de 40'-0" x 28'-0", folha tabloide (17" x 11"), escala 1/4" = 1'-0" (18 points por pé).
Uso: python3 tools/gerar-planta.py  →  assets/plantas/casa-modelo-a101.pdf
"""
import math

PT_PE = 18.0            # 1/4" = 1'-0": 1 pé = 0,25" de papel = 18 points
X0, Y0 = 110.0, 190.0   # canto inferior esquerdo da casa na folha
W, H = 1224, 792        # folha tabloide deitada

c = []                  # comandos do conteúdo da página
def px(x): return X0 + x * PT_PE
def py(y): return Y0 + y * PT_PE
def esc(t): return t.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')
def linha(x1, y1, x2, y2, lw=0.6):
    c.append('%.2f w %.2f %.2f m %.2f %.2f l S' % (lw, x1, y1, x2, y2))
def parede(x1, y1, x2, y2, esp):  # em pés, linha grossa centrada (espessura em pés)
    c.append('0 J %.2f w %.2f %.2f m %.2f %.2f l S' % (esp * PT_PE, px(x1), py(y1), px(x2), py(y2)))
def texto(x, y, t, tam=9, fonte='F1', rot=0, centro=False):
    larg = len(t) * tam * 0.5 if centro else 0
    if rot:
        c.append('BT /%s %.1f Tf 0 1 -1 0 %.2f %.2f Tm (%s) Tj ET' % (fonte, tam, x, y - larg, esc(t)))
    else:
        c.append('BT /%s %.1f Tf %.2f %.2f Td (%s) Tj ET' % (fonte, tam, x - larg, y, esc(t)))
def arco_porta(cx, cy, r, a0, a1):  # arco de abertura de porta (pés, graus), aproximado por segmentos
    pts = [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / 12)), cy + r * math.sin(math.radians(a0 + (a1 - a0) * i / 12))) for i in range(13)]
    c.append('0.4 w [2 2] 0 d %.2f %.2f m ' % (px(pts[0][0]), py(pts[0][1])) + ' '.join('%.2f %.2f l' % (px(a), py(b)) for a, b in pts[1:]) + ' S [] 0 d')
    linha(px(cx), py(cy), px(cx + r * math.cos(math.radians(a1))), py(cy + r * math.sin(math.radians(a1))), 0.6)
def janela(x1, y1, x2, y2):  # vão branco na parede externa com três linhas finas
    if y1 == y2: c.append('1 g %.2f %.2f %.2f %.2f re f 0 g' % (px(x1), py(y1 - E / 2), (x2 - x1) * PT_PE, E * PT_PE))
    else: c.append('1 g %.2f %.2f %.2f %.2f re f 0 g' % (px(x1 - E / 2), py(y1), E * PT_PE, (y2 - y1) * PT_PE))
    for d in (-0.2, 0, 0.2):
        if y1 == y2: linha(px(x1), py(y1 + d), px(x2), py(y2 + d), 0.4)
        else: linha(px(x1 + d), py(y1), px(x2 + d), py(y2), 0.4)
def cota(x1, y1, x2, y2, t, lado=1):  # cota com linha, marcas a 45° e texto (pés)
    a, b, cc, d = px(x1), py(y1), px(x2), py(y2)
    linha(a, b, cc, d, 0.4)
    for (u, v) in ((a, b), (cc, d)):
        linha(u - 4, v - 4, u + 4, v + 4, 0.8)
    if y1 == y2: texto((a + cc) / 2, b + 4 * lado, t, 9, centro=True)
    else: texto(a - 4 if lado > 0 else a + 12, (b + d) / 2, t, 9, rot=1, centro=True)

E, I = 0.5, 0.375   # paredes: externa 6", interna 4 1/2"
h = E / 2
# Paredes externas (linha de centro), com vãos de porta e janela
parede(0, h, 8, h, E); parede(11, h, 40, h, E)                    # sul (porta de entrada 8'-11')
parede(40 - h, 0, 40 - h, 28, E)                                  # leste
parede(0, 28 - h, 40, 28 - h, E)                                  # norte
parede(h, 0, h, 28, E)                                            # oeste
# Paredes internas
parede(22, E, 22, 7, I); parede(22, 10, 22, 28 - E, I)            # entre sala e quartos (porta 7'-10')
parede(E, 16, 6, 16, I); parede(14, 16, 22, 16, I)                # sala | cozinha (abertura de 8')
parede(22, 12, 26, 12, I); parede(29, 12, 40 - E, 12, I)          # quarto 1 | banheiro (porta)
parede(22, 18, 31, 18, I); parede(34, 18, 40 - E, 18, I)          # banheiro | quarto 2 (porta)
parede(30, 12, 30, 18, I)                                         # banheiro | closet
# Portas
arco_porta(8, h, 3, 0, 90); arco_porta(22, 7, 3, 90, 0); arco_porta(26, 12, 3, 0, 90); arco_porta(31, 18, 3, 0, 90)
# Janelas
janela(14, h, 19, h); janela(30, h, 35, h); janela(30, 28 - h, 35, 28 - h); janela(6, 28 - h, 10, 28 - h); janela(h, 6, h, 11); janela(40 - h, 4, 40 - h, 8)
# Nomes dos ambientes
for (x, y, t) in ((11, 8, 'LIVING ROOM'), (11, 22, 'KITCHEN / DINING'), (31, 6, 'BEDROOM 1'), (26, 15, 'BATH'), (35, 15, 'CLOSET'), (31, 23, 'BEDROOM 2')):
    texto(px(x), py(y), t, 8, 'F2', centro=True)
# Cotas
cota(0, 31, 40, 31, "40'-0\"")                                    # total, em cima
cota(-3, 0, -3, 28, "28'-0\"")                                    # total, à esquerda
cota(0, -3, 22, -3, "22'-0\"", -1); cota(22, -3, 40, -3, "18'-0\"", -1)     # parcial, embaixo
for (u, v, t) in ((0, 12, "12'-0\""), (12, 18, "6'-0\""), (18, 28, "10'-0\"")):
    cota(43, u, 43, v, t, -1)                                     # parcial, à direita
# Margem da folha e carimbo
c.append('1 w 24 24 %d %d re S' % (W - 48, H - 48))
c.append('1 w 940 24 260 %d re S' % (H - 48))
for (y, t, tam, f) in ((730, 'KORbuild', 16, 'F2'), (712, 'Planta de exemplo', 9, 'F1'), (640, 'CASA MODELO', 14, 'F2'), (622, '1450 Elm St, Manchester, NH', 9, 'F1'),
                       (560, 'FIRST FLOOR PLAN', 13, 'F2'), (540, 'SCALE: 1/4" = 1\'-0"', 10, 'F1'), (120, 'SHEET', 8, 'F1'), (90, 'A-101', 28, 'F2'), (50, 'Prototipo - planta ficticia', 8, 'F1')):
    texto(956, y, t, tam, f)
# Escala gráfica (0, 2, 4, 8 pés), em escala real
for i, (a, b) in enumerate(((0, 2), (2, 4), (4, 8))):
    if i % 2 == 0: c.append('0 g %.2f 500 %.2f 6 re f' % (956 + a * PT_PE, (b - a) * PT_PE))
c.append('0 g 0.6 w 956 500 %.2f 6 re S' % (8 * PT_PE))
for v in (0, 2, 4, 8): texto(956 + v * PT_PE - 2, 488, str(v) + "'", 7)
texto(956, 474, 'GRAPHIC SCALE', 7, 'F2')
# Rosa dos ventos
c.append('0.8 w 1100 470 m 1110 500 l 1120 470 l h S'); texto(1106, 506, 'N', 10, 'F2')

conteudo = '\n'.join(c).encode('latin-1')
objs = [
    b'<< /Type /Catalog /Pages 2 0 R >>',
    b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %d %d] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>' % (W, H),
    b'<< /Length %d >>\nstream\n' % len(conteudo) + conteudo + b'\nendstream',
    b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
]
saida = bytearray(b'%PDF-1.4\n%\xe2\xe3\xcf\xd3\n')
offs = []
for i, o in enumerate(objs, 1):
    offs.append(len(saida))
    saida += b'%d 0 obj\n' % i + o + b'\nendobj\n'
xref = len(saida)
saida += b'xref\n0 %d\n0000000000 65535 f \n' % (len(objs) + 1) + b''.join(b'%010d 00000 n \n' % o for o in offs)
saida += b'trailer\n<< /Size %d /Root 1 0 R /Info << /Title (Casa modelo - A-101 First Floor Plan) /Producer (KORbuild) >> >>\nstartxref\n%d\n%%%%EOF\n' % (len(objs) + 1, xref)
open('assets/plantas/casa-modelo-a101.pdf', 'wb').write(saida)
print('ok', len(saida), 'bytes')
