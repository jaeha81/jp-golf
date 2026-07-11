$ErrorActionPreference = 'Stop'

$nodeDir = 'C:\Users\user1\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'
$pnpm = 'C:\Users\user1\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd'
$env:Path = "$nodeDir;$env:Path"

if (-not (Test-Path -LiteralPath $pnpm)) {
    throw "pnpm 실행 파일을 찾을 수 없습니다: $pnpm"
}

$secureKey = Read-Host 'Gemini AQ 키만 붙여넣고 Enter를 누르세요' -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)

try {
    $plainKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr).Trim()

    if ($plainKey -notmatch '^AQ[.-]' -or $plainKey -match '\s') {
        throw 'AQ 키 형식이 아닙니다. 명령어가 아니라 Google AI Studio에서 복사한 키만 입력하세요.'
    }

    & $pnpm dlx vercel env add GEMINI_API_KEY preview --value $plainKey --sensitive --force --yes
    if ($LASTEXITCODE -ne 0) { throw 'Preview 키 등록에 실패했습니다.' }

    & $pnpm dlx vercel env add GEMINI_API_KEY production --value $plainKey --sensitive --force --yes
    if ($LASTEXITCODE -ne 0) { throw 'Production 키 등록에 실패했습니다.' }

    Write-Host '완료: Preview와 Production에 AQ 키를 정확히 등록했습니다.' -ForegroundColor Green
}
finally {
    if ($ptr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
    Remove-Variable plainKey, secureKey -ErrorAction SilentlyContinue
}
