Option Explicit

Dim shell, fileSystem, scriptDirectory, projectDirectory, phpExecutable, dispatcher, command, exitCode
Set shell = CreateObject("WScript.Shell")
Set fileSystem = CreateObject("Scripting.FileSystemObject")

scriptDirectory = fileSystem.GetParentFolderName(WScript.ScriptFullName)
projectDirectory = fileSystem.GetParentFolderName(scriptDirectory)
phpExecutable = "C:\xampp\php\php.exe"
dispatcher = scriptDirectory & "\dispatch-notification-emails.php"

If Not fileSystem.FileExists(phpExecutable) Or Not fileSystem.FileExists(dispatcher) Then
    WScript.Quit 2
End If

command = Chr(34) & phpExecutable & Chr(34) & " " & Chr(34) & dispatcher & Chr(34) & " --limit=100"
exitCode = shell.Run(command, 0, True)
WScript.Quit exitCode
