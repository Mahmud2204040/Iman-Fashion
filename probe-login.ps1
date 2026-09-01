# Self-contained probe: probe dev server endpoints + walk the import graph.
# Pure Node, no PowerShell session needed (run via npm-run-script).

$ErrorActionPreference = 'Stop'
$BASE = 'http://localhost:5173'

function Probe-Url {
    param([string]$Url)
    try {
        $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 8 -Uri $Url
        return [pscustomobject]@{ Status = [int]$r.StatusCode; Body = $r.Content; Err = $null }
    } catch {
        return [pscustomobject]@{ Status = -1; Body = $null; Err = $_.Exception.Message }
    }
}

$results = @()

# 1. /login returns 200 + has <div id="root">
$r = Probe-Url "$BASE/login"
$results += [pscustomobject]{
    Name  = '/login HTTP 200'
    Pass  = ($r.Status -eq 200)
    Detail= "status=$($r.Status)"
}
$results += [pscustomobject]{
    Name  = '/login HTML has <div id="root">'
    Pass  = ($r.Body -match 'id="root"')
    Detail= "len=$(($r.Body | Out-String).Length)"
}
$results += [pscustomobject]{
    Name  = '/login HTML loads main.jsx via Vite client'
    Pass  = ($r.Body -match '/src/main\.jsx' -or $r.Body -match '/@vite/client')
    Detail= 'main.jsx entry'
}

# 2. /src/main.jsx transforms cleanly
$r = Probe-Url "$BASE/src/main.jsx"
$results += [pscustomobject]{
    Name  = 'Vite transforms /src/main.jsx (200, no error)'
    Pass  = ($r.Status -eq 200 -and -not $r.Body.StartsWith('Internal'))
    Detail= "status=$($r.Status), len=$($r.Body.Length)"
}

# 3. Walk the import graph 2 layers deep from main.jsx
$visited = @{}
$current = $r.Body
$layer = 0
while ($layer -lt 2 -and $current) {
    $layer++
    $regex = [regex]'from\s+["'']([^"'']+\.(?:jsx?|js))["'']'
    $matches = $regex.Matches($current)
    $next = @()
    foreach ($m in $matches) {
        $spec = $m.Groups[1].Value
        if ($spec.StartsWith('/') -and -not $visited.ContainsKey($spec)) {
            $next += $spec
            $visited[$spec] = $true
        }
    }
    foreach ($u in $next) {
        $rr = Probe-Url "$BASE$u"
        $results += [pscustomobject]{
            Name  = "$u → $(if ($rr.Status -eq 200 -and -not $rr.Body.StartsWith('Internal')) {'OK'} else {'FAIL'})"
            Pass  = ($rr.Status -eq 200 -and -not $rr.Body.StartsWith('Internal'))
            Detail= "$($rr.Status), $($rr.Body.Length)B"
        }
        if ($layer -eq 1) { $current = $rr.Body }
    }
}

$pass = ($results | Where-Object { $_.Pass }).Count
$fail = ($results | Where-Object { -not $_.Pass }).Count
foreach ($c in $results) {
    if ($c.Pass) { Write-Host "OK   $($c.Name)" }
    else        { Write-Host "FAIL $($c.Name)  →  $($c.Detail)" -ForegroundColor Red }
}
Write-Host ""
Write-Host "$pass passed, $fail failed."
exit $fail
