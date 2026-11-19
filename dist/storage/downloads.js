'use strict';

function downloadFile(filename, contents, type) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function exportBackup() {
  downloadFile(`path-to-glory-${Ledger.date()}.json`, JSON.stringify(CampaignStore.data, null, 2), 'application/json');
  tell('Backup downloaded.');
}
