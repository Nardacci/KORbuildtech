# KORbuild — roda os testes automáticos e gera um resumo (docs/roteiro-de-testes.md).
#
# Uso, na pasta do projeto, no PowerShell:
#   .\tools\testar.ps1                  # tudo: protótipo, telas oficiais e banco
#   .\tools\testar.ps1 -Parte prototipo # só o que roda no navegador, sem banco (não precisa de token)
#   .\tools\testar.ps1 -Parte banco     # só o que fala com o Supabase (precisa de $env:SUPABASE_ACCESS_TOKEN)
#   .\tools\testar.ps1 -Somente crew,obras
#
# Nada aqui altera a estrutura do banco: os testes SQL terminam em ROLLBACK, e o teste da conta cria usuários
# kb-e2e-…@example.com e apaga tudo no fim. Migrações NÃO são executadas por este script.
# O resultado fica em .testes/<data-hora>/ (resumo.md + a saída completa de cada teste).

param(
  [ValidateSet('tudo', 'prototipo', 'banco')] [string] $Parte = 'tudo',
  [string[]] $Somente = @(),
  [int] $Porta = 8123
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$raiz = Split-Path -Parent $PSScriptRoot
$Somente = @($Somente | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
$pasta = Join-Path $raiz ('.testes/' + (Get-Date -Format 'yyyy-MM-dd_HH-mm'))
New-Item -ItemType Directory -Force -Path $pasta | Out-Null
Set-Location $raiz
$base = "http://localhost:$Porta/"

function Escrever($texto, $cor = 'Gray') { Write-Host $texto -ForegroundColor $cor }

# ---------- Conferências antes de começar ----------
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Escrever 'Node.js não encontrado. Instale o Node 20 ou mais novo.' Red; exit 2 }
& node -e "import('playwright').then(()=>process.exit(0),()=>process.exit(1))" 2>$null
if ($LASTEXITCODE -ne 0) {
  Escrever 'O Playwright não está instalado nesta pasta. Rode uma vez:' Yellow
  Escrever '  npm install --no-save playwright@1.56.1' White
  Escrever '  npx playwright install chromium' White
  exit 2
}
$temToken = [bool]$env:SUPABASE_ACCESS_TOKEN
if ($Parte -ne 'prototipo' -and -not $temToken) {
  Escrever 'Sem $env:SUPABASE_ACCESS_TOKEN: os testes do banco ficam de fora (rode com -Parte prototipo para não ver este aviso).' Yellow
}

# ---------- Servidor local (sobe se ainda não estiver no ar) ----------
$servidor = $null
function NoAr { try { Invoke-WebRequest -Uri $base -UseBasicParsing -TimeoutSec 2 | Out-Null; return $true } catch { return $false } }
if (-not (NoAr)) {
  $py = @('py', 'python3', 'python') | Where-Object { Get-Command $_ -ErrorAction SilentlyContinue } | Select-Object -First 1
  if (-not $py) { Escrever "Python não encontrado para subir o servidor. Suba um na porta $Porta e rode de novo." Red; exit 2 }
  $opcoes = @{ FilePath = $py; ArgumentList = @('-m', 'http.server', $Porta); WorkingDirectory = $raiz; PassThru = $true
    RedirectStandardOutput = (Join-Path $pasta 'servidor.txt'); RedirectStandardError = (Join-Path $pasta 'servidor-erros.txt') }
  if ($PSVersionTable.PSEdition -eq 'Desktop' -or $IsWindows) { $opcoes.WindowStyle = 'Hidden' }
  $servidor = Start-Process @opcoes
  for ($i = 0; $i -lt 20 -and -not (NoAr); $i++) { Start-Sleep -Milliseconds 500 }
  if (-not (NoAr)) { Escrever "O servidor não subiu na porta $Porta." Red; exit 2 }
  Escrever "Servidor local em $base" DarkGray
}

# ---------- O que roda ----------
# Protótipo e telas oficiais: no navegador, sem banco. Banco: SQL (com ROLLBACK) e a conta de verdade.
$prototipo = Get-ChildItem tests -Filter '*.test.mjs' | Where-Object { $_.Name -notin @('conta.test.mjs', 'daily.test.mjs') } | Sort-Object Name |
  ForEach-Object { @{ nome = $_.BaseName -replace '\.test$', ''; tipo = 'navegador'; cmd = @($_.FullName, $base) } }
$banco = @()
if ($temToken) {
  $banco += Get-ChildItem supabase/testes -Filter '*.sql' | Sort-Object Name |
    ForEach-Object { @{ nome = 'sql ' + $_.BaseName; tipo = 'banco'; cmd = @('tools/rodar-sql.mjs', $_.FullName) } }
  $banco += @{ nome = 'conta'; tipo = 'banco'; cmd = @('tests/conta.test.mjs', $base) }
  $banco += @{ nome = 'daily'; tipo = 'banco'; cmd = @('tests/daily.test.mjs', $base, '--real') }
}
$lista = switch ($Parte) { 'prototipo' { $prototipo } 'banco' { $banco } default { $prototipo + $banco } }
if ($Somente.Count) { $lista = $lista | Where-Object { $n = $_.nome; $Somente | Where-Object { $n -like "*$_*" } } }

# ---------- Rodar ----------
$commit = (& git rev-parse --short HEAD 2>$null)
$resultados = @()
$ErrorActionPreference = 'Continue'
foreach ($t in $lista) {
  Escrever ('> ' + $t.nome) Cyan
  $inicio = Get-Date
  $argumentos = $t.cmd
  $saida = & node @argumentos 2>&1 | ForEach-Object { "$_" }
  $codigo = $LASTEXITCODE
  $segundos = [math]::Round(((Get-Date) - $inicio).TotalSeconds)
  $saida | Set-Content -Encoding UTF8 (Join-Path $pasta (($t.nome -replace '[^\w-]', '_') + '.txt'))
  $placar = ($saida | Select-String 'verificações passaram' | Select-Object -Last 1)
  $placar = if ($placar) { ($placar.Line -replace 'verificações passaram', '').Trim() } else { '—' }
  $falhas = @($saida | Where-Object { $_ -match '^FALHA' -or $_ -match '^\s{6}\S' })
  if ($codigo -ne 0 -and -not $falhas.Count) { $falhas = @($saida | Select-Object -Last 8) }  # quebrou antes das verificações: mostra o fim da saída
  $ok = ($codigo -eq 0)
  $resultados += [pscustomobject]@{ Teste = $t.nome; Tipo = $t.tipo; Resultado = $(if ($ok) { 'ok' } else { 'FALHOU' }); Placar = $placar; Segundos = $segundos; Falhas = $falhas }
  if ($ok) { Escrever "   ok  $placar  (${segundos}s)" Green } else { Escrever "   FALHOU  $placar  (${segundos}s)" Red; $falhas | Select-Object -First 6 | ForEach-Object { Escrever "     $_" Red } }
}
if ($servidor) { Stop-Process -Id $servidor.Id -Force -ErrorAction SilentlyContinue; Escrever 'Servidor local encerrado.' DarkGray }

# ---------- Resumo ----------
$falharam = @($resultados | Where-Object { $_.Resultado -ne 'ok' })
$md = @("# KORbuild — resultado dos testes", '', "- Data: $(Get-Date -Format 'yyyy-MM-dd HH:mm')", "- Commit: $commit", "- Parte: $Parte", '',
  '| Teste | Tipo | Resultado | Verificações | Tempo |', '|---|---|---|---|---|')
$md += $resultados | ForEach-Object { "| $($_.Teste) | $($_.Tipo) | $($_.Resultado) | $($_.Placar) | $($_.Segundos)s |" }
if ($falharam.Count) {
  $md += @('', '## Falhas', '')
  foreach ($f in $falharam) { $md += "### $($f.Teste)"; $md += '```'; $md += $f.Falhas; $md += '```'; $md += '' }
}
if ($Parte -ne 'prototipo' -and -not $temToken) { $md += @('', '> Os testes do banco não rodaram: falta $env:SUPABASE_ACCESS_TOKEN.') }
$resumo = Join-Path $pasta 'resumo.md'
$md | Set-Content -Encoding UTF8 $resumo

Escrever ''
if ($falharam.Count) { Escrever "$($falharam.Count) teste(s) falharam. Resumo: $resumo" Red; exit 1 }
Escrever "Todos os $($resultados.Count) testes passaram. Resumo: $resumo" Green
exit 0
