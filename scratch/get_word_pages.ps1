$ErrorActionPreference = "Stop"
$docxPath = "c:\forwork\Web\farmgap\farmgap\Research-Paper.docx"
$outJsonPath = "c:\forwork\Web\farmgap\farmgap\scratch\word_pages.json"

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

try {
    $doc = $word.Documents.Open($docxPath, $false, $true)
    $doc.Repaginate()

    $results = @{}
    for ($i = 0; $i -lt 100; $i++) {
        $bmName = "_TocTarget_$i"
        if ($doc.Bookmarks.Exists($bmName)) {
            $bm = $doc.Bookmarks.Item($bmName)
            # wdActiveEndAdjustedPageNumber = 3, wdActiveEndPageNumber = 1
            $adjPage = $bm.Range.Information(3)
            $physPage = $bm.Range.Information(1)
            $results[$bmName] = @{
                adjPage = $adjPage
                physPage = $physPage
            }
        }
    }

    $json = $results | ConvertTo-Json -Depth 4
    [System.IO.File]::WriteAllText($outJsonPath, $json, [System.Text.Encoding]::UTF8)
    $doc.Close($false)
    Write-Output "Successfully extracted 100 bookmark page numbers from Word."
}
finally {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}
