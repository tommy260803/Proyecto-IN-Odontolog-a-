// Secretos fuera del repositorio. NTFS: solo el SID del usuario actual.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const directory = path.join(process.env.LOCALAPPDATA, 'NexoSalud', 'QA', 'BuyerEnsayoFinal');
const credentialPath = path.join(directory, 'credencial_buyer_qa_ensayofinal.json');
function protect(target, folder) {
  if (process.platform !== 'win32') throw Error('QA_WINDOWS_ACL_REQUIRED');
  const quoted = target.replace(/'/g, "''");
  const script = `$ErrorActionPreference='Stop'; $p='${quoted}';
    $sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User;
    $acl=New-Object System.Security.AccessControl.${folder ? 'DirectorySecurity' : 'FileSecurity'};
    $acl.SetAccessRuleProtection($true,$false); $acl.SetOwner($sid);
    $rule=New-Object System.Security.AccessControl.FileSystemAccessRule(${folder
      ? "$sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow'"
      : "$sid,'FullControl','Allow'"});
    $acl.AddAccessRule($rule); [System.IO.${folder ? 'Directory' : 'File'}]::SetAccessControl($p,$acl);
    $check=[System.IO.${folder ? 'Directory' : 'File'}]::GetAccessControl($p);
    if(!$check.AreAccessRulesProtected -or @($check.Access | Where-Object {$_.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value -ne $sid.Value}).Count){throw 'ACL_REJECTED'}`;
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script,'utf16le').toString('base64')], {stdio:'pipe', windowsHide:true});
}
function prepare() {
  fs.mkdirSync(directory, {recursive:true});
  protect(directory, true);
  if (fs.existsSync(credentialPath)) protect(credentialPath, false);
}
function read() { prepare(); return JSON.parse(fs.readFileSync(credentialPath, 'utf8')); }
function create(value) {
  prepare();
  fs.writeFileSync(credentialPath, JSON.stringify(value, null, 2), {flag:'wx'});
  protect(credentialPath, false);
}
module.exports = { credentialPath, read, create, prepare };
