' Ugyanaz, mint az INDITAS.bat, csak nem marad nyitva fekete konzolablak.
' Ha bezárod a build ablakot, a háttérprogram magától kilép (kb. 40 mp-en belül).
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = fso.GetParentFolderName(WScript.ScriptFullName)
On Error Resume Next
sh.Run "pyw -3 server.py", 0, False
If Err.Number <> 0 Then
    Err.Clear
    sh.Run "pythonw server.py", 0, False
    If Err.Number <> 0 Then
        MsgBox "Nem talalom a Pythont. Telepitsd: https://www.python.org/downloads/ (Add python.exe to PATH)", 48, "RiftMester"
    End If
End If
