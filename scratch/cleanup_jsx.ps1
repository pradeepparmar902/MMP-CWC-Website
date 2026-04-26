$file = "src/components/SamajJogSandesh.jsx"
$c = Get-Content $file -Raw -Encoding UTF8
$c = $c -replace 'Â°', '°'
$c = $c -replace 'ðŸ–Š', '🖊'
$c = $c -replace 'ðŸ§¹', '🧹'
$c = $c -replace 'ðŸŒˆ', '🌈'
$c = $c -replace 'ðŸŽ¨', '🎨'
$c = $c -replace 'ðŸ‘‘', '👑'
$c = $c -replace 'ðŸ‘ ', '👑'
$c = $c -replace '</div></div><div className="modal-actions">', "</div></div>`n              <div className=""modal-actions"">"
$c | Set-Content $file -Encoding UTF8
