Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"

$downloads = "C:\Users\Otaku\Downloads"
$appRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$outRoot = Join-Path $appRoot "assets\cards\flame-chasers"

$cards = @(
    @{ Roman = "I";    Rank = "A";  Name = "Kevin";      Zh = "凯文";     En = "Kevin";      Ja = "ケビン";         File = "778a94dd1dfff0f72d78c237baf4a898_8798220128975647576.png" },
    @{ Roman = "II";   Rank = "2";  Name = "Elysia";     Zh = "爱莉希雅"; En = "Elysia";     Ja = "エリシア";       File = "7ae1f63eec4225f1040eca6628da06a9_5278240326513011938.png" },
    @{ Roman = "III";  Rank = "3";  Name = "Aponia";     Zh = "阿波尼亚"; En = "Aponia";     Ja = "アポニア";       File = "a4cdc7c84755c5a4cf724876975f004c_3024324412802659030.png" },
    @{ Roman = "IV";   Rank = "4";  Name = "Eden";       Zh = "伊甸";     En = "Eden";       Ja = "エデン";         File = "5587f4d9c06d3c7ac64495228bbd38d7_1452860756639920438.png" },
    @{ Roman = "V";    Rank = "5";  Name = "Vill-V";     Zh = "维尔薇";   En = "Vill-V";     Ja = "ヴィルヴィ";     File = "892648302889440794855a1717f8093f_42821508078093688.png" },
    @{ Roman = "VI";   Rank = "6";  Name = "Kalpas";     Zh = "千劫";     En = "Kalpas";     Ja = "カルパス";       File = "31c53852f5e231be61caf0486951c1ae_1379490521570918858.png" },
    @{ Roman = "VII";  Rank = "7";  Name = "Su";         Zh = "苏";       En = "Su";         Ja = "スウ";           File = "d9fbd4065345be19d504f7b821de3645_3792379379234154315.png" },
    @{ Roman = "VIII"; Rank = "8";  Name = "Sakura";     Zh = "樱";       En = "Sakura";     Ja = "サクラ";         File = "659b143a887644bd344324072d7d9422_6816080553840225984.png" },
    @{ Roman = "IX";   Rank = "9";  Name = "Kosma";      Zh = "科斯魔";   En = "Kosma";      Ja = "コズマ";         File = "92ef1a8f6884076cf9e351819a576128_4910172850564557344.png" },
    @{ Roman = "X";    Rank = "10"; Name = "Mobius";     Zh = "梅比乌斯"; En = "Mobius";     Ja = "メビウス";       File = "00c9e77839c7d943892eb10d95f220eb_5027010881072887209.png" },
    @{ Roman = "XI";   Rank = "J";  Name = "Griseo";     Zh = "格蕾修";   En = "Griseo";     Ja = "グレーシュ";     File = "e5e47d7f867c56cfacd2499452a990a6_3028479118722583739.png" },
    @{ Roman = "XII";  Rank = "Q";  Name = "Hua";        Zh = "华";       En = "Hua";        Ja = "フカ";           File = "718f8c1b8a2279397bfc6c3c1a6cb6d7_7025479164927301675.png" },
    @{ Roman = "XIII"; Rank = "K";  Name = "Pardofelis"; Zh = "帕朵菲莉丝"; En = "Pardofelis"; Ja = "パルドフェリス"; File = "adf5631093ccc49bcde0c91c889505a6_1599952543482170097.png" }
)

$locales = @(
    @{ Id = "zh-CN"; Title = "逐火十三英桀"; NameKey = "Zh"; Font = "Microsoft YaHei UI" },
    @{ Id = "en-US"; Title = "Flame-Chasers"; NameKey = "En"; Font = "Georgia" },
    @{ Id = "ja-JP"; Title = "火を追う十三英傑"; NameKey = "Ja"; Font = "Yu Gothic UI" }
)

$suits = @(
    @{ Name = "Spades";   Symbol = [string][char]0x2660; Color = [System.Drawing.Color]::FromArgb(28, 28, 28) },
    @{ Name = "Hearts";   Symbol = [string][char]0x2665; Color = [System.Drawing.Color]::FromArgb(190, 28, 46) },
    @{ Name = "Diamonds"; Symbol = [string][char]0x2666; Color = [System.Drawing.Color]::FromArgb(190, 28, 46) },
    @{ Name = "Clubs";    Symbol = [string][char]0x2663; Color = [System.Drawing.Color]::FromArgb(28, 28, 28) }
)

function Load-Bitmap($path) {
    $fs = [System.IO.File]::OpenRead($path)
    try {
        $img = [System.Drawing.Image]::FromStream($fs)
        return New-Object System.Drawing.Bitmap($img)
    }
    finally {
        if ($img) { $img.Dispose() }
        $fs.Dispose()
    }
}

function Draw-CoverImage($graphics, $image, $destRect) {
    $srcRatio = $image.Width / $image.Height
    $dstRatio = $destRect.Width / $destRect.Height
    if ($srcRatio -gt $dstRatio) {
        $srcH = $image.Height
        $srcW = [int]($srcH * $dstRatio)
        $srcX = [int](($image.Width - $srcW) / 2)
        $srcY = 0
    } else {
        $srcW = $image.Width
        $srcH = [int]($srcW / $dstRatio)
        $srcX = 0
        $srcY = [int](($image.Height - $srcH) / 2)
    }
    $srcRect = New-Object System.Drawing.Rectangle($srcX, $srcY, $srcW, $srcH)
    $graphics.DrawImage($image, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
}

function Draw-Corner($graphics, $rank, $suitSymbol, $brush, $x, $y, [bool]$rotated) {
    $rankFont = New-Object System.Drawing.Font("Georgia", 30, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $suitFont = New-Object System.Drawing.Font("Segoe UI Symbol", 27, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $state = $graphics.Save()
    if ($rotated) {
        $graphics.TranslateTransform($x + 42, $y + 70)
        $graphics.RotateTransform(180)
        $x = 0
        $y = 0
    }
    $graphics.DrawString($rank, $rankFont, $brush, ([System.Drawing.RectangleF]::new([single]$x, [single]$y, 42, 34)), $format)
    $graphics.DrawString($suitSymbol, $suitFont, $brush, ([System.Drawing.RectangleF]::new([single]$x, [single]($y + 30), 42, 32)), $format)
    $graphics.Restore($state)
    $rankFont.Dispose()
    $suitFont.Dispose()
    $format.Dispose()
}

function Save-Card($src, $card, $suit, $locale) {
    $cardW = 320
    $cardH = 448
    $bmp = New-Object System.Drawing.Bitmap($cardW, $cardH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    try {
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

        $cream = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(250, 246, 235))
        $ink = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(34, 28, 22))
        $gold = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(174, 133, 72))
        $muted = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(118, 87, 58))
        $shade = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(178, 8, 8, 8))
        $suitBrush = New-Object System.Drawing.SolidBrush($suit.Color)

        $g.FillRectangle($cream, 0, 0, $cardW, $cardH)
        $g.DrawRectangle((New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(136, 98, 64, 35), 2)), 6, 6, $cardW - 13, $cardH - 13)
        $g.DrawRectangle((New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(80, 0, 0, 0), 1)), 11, 11, $cardW - 23, $cardH - 23)

        Draw-CoverImage $g $src (New-Object System.Drawing.Rectangle(28, 92, 264, 154))
        $g.FillRectangle($shade, 28, 92, 264, 154)
        Draw-CoverImage $g $src (New-Object System.Drawing.Rectangle(34, 98, 252, 142))
        $g.DrawRectangle((New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(180, 172, 133, 74), 2)), 34, 98, 252, 142)

        Draw-Corner $g $card.Rank $suit.Symbol $suitBrush 14 14 $false
        Draw-Corner $g $card.Rank $suit.Symbol $suitBrush ($cardW - 56) ($cardH - 84) $true

        $titleFont = New-Object System.Drawing.Font($locale.Font, 18, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
        $nameFont = New-Object System.Drawing.Font($locale.Font, 30, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
        $romanFont = New-Object System.Drawing.Font("Georgia", 38, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
        $symbolFont = New-Object System.Drawing.Font("Segoe UI Symbol", 126, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
        $center = New-Object System.Drawing.StringFormat
        $center.Alignment = [System.Drawing.StringAlignment]::Center
        $center.LineAlignment = [System.Drawing.StringAlignment]::Center

        $g.DrawString($locale.Title, $titleFont, $muted, ([System.Drawing.RectangleF]::new(52, 28, 216, 30)), $center)
        $g.DrawString($suit.Symbol, $symbolFont, (New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(22, $suit.Color))), ([System.Drawing.RectangleF]::new(0, 246, $cardW, 132)), $center)
        $g.DrawString($card.Roman, $romanFont, $gold, ([System.Drawing.RectangleF]::new(0, 255, $cardW, 54)), $center)
        $g.DrawString($card[$locale.NameKey], $nameFont, $ink, ([System.Drawing.RectangleF]::new(0, 314, $cardW, 48)), $center)
        $g.DrawLine((New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(150, 174, 133, 72), 1)), 58, 382, $cardW - 58, 382)

        $outDir = Join-Path $outRoot $locale.Id
        New-Item -ItemType Directory -Force -Path $outDir | Out-Null
        $outPath = Join-Path $outDir ("{0}-{1}.png" -f $card.Name, $suit.Name)
        $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        foreach ($obj in @($cream, $ink, $gold, $muted, $shade, $suitBrush, $titleFont, $nameFont, $romanFont, $symbolFont, $center)) {
            if ($obj) { $obj.Dispose() }
        }
        $g.Dispose()
        $bmp.Dispose()
    }
}

foreach ($locale in $locales) {
    New-Item -ItemType Directory -Force -Path (Join-Path $outRoot $locale.Id) | Out-Null
}

foreach ($card in $cards) {
    $srcPath = Join-Path $downloads $card.File
    if (!(Test-Path -LiteralPath $srcPath)) {
        throw "Missing source image: $srcPath"
    }
    $src = Load-Bitmap $srcPath
    try {
        foreach ($locale in $locales) {
            foreach ($suit in $suits) {
                Save-Card $src $card $suit $locale
            }
        }
    }
    finally {
        $src.Dispose()
    }
}

function Build-Atlas($localeId) {
    $rankOrder = @("A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K")
    $suitOrder = @("Spades", "Hearts", "Diamonds", "Clubs")
    $nameByRank = @{}
    foreach ($card in $cards) { $nameByRank[$card.Rank] = $card.Name }

    $cellW = 320
    $cellH = 448
    $atlas = New-Object System.Drawing.Bitmap ($cellW * 4), ($cellH * 13), ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($atlas)
    try {
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.Clear([System.Drawing.Color]::Transparent)

        for ($r = 0; $r -lt $rankOrder.Count; $r++) {
            for ($s = 0; $s -lt $suitOrder.Count; $s++) {
                $src = Join-Path $outRoot (Join-Path $localeId ("{0}-{1}.png" -f $nameByRank[$rankOrder[$r]], $suitOrder[$s]))
                if (!(Test-Path -LiteralPath $src)) { throw "Missing generated card: $src" }
                $img = [System.Drawing.Image]::FromFile($src)
                try {
                    $x = [int]($s * $cellW)
                    $y = [int]($r * $cellH)
                    $g.DrawImage($img, (New-Object System.Drawing.Rectangle($x, $y, $cellW, $cellH)))
                }
                finally {
                    $img.Dispose()
                }
            }
        }
        $out = Join-Path $outRoot "$localeId-atlas.png"
        $atlas.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        $g.Dispose()
        $atlas.Dispose()
    }
}

foreach ($locale in $locales) {
    Build-Atlas $locale.Id
}

Get-ChildItem -LiteralPath $outRoot -File -Filter "*-atlas.png" | Sort-Object Name | Select-Object FullName,Length
