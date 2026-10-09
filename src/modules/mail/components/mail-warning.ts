const warnings: Record<string, string> = {
  "Review the imported values before recording the charge.": "Confira os valores importados antes de registrar a cobrança.",
  "No supported invoice fields were found. Enter the document details manually.": "Não foi possível extrair todos os campos. Complete os dados do documento manualmente.",
  "PDF files are attached without automatic field extraction.": "Arquivos PDF são anexados sem extração automática de campos.",
  "Select an XML file to import.": "Selecione um arquivo XML para importar.",
  "Message MIME structure is too complex; its content was not imported.": "A estrutura da mensagem é muito complexa e seu conteúdo não foi importado.",
  "The message text uses an unsupported charset and may contain replacement characters.": "A codificação do texto não é suportada e alguns caracteres podem aparecer substituídos.",
  "The plain text body exceeds 16 KiB and was not imported.": "O texto da mensagem ultrapassa 16 KiB e não foi importado.",
  "The plain text body is limited to a 16 KiB preview.": "A prévia do texto da mensagem está limitada a 16 KiB.",
  "This message has no plain text body. HTML was not imported.": "A mensagem não possui uma versão em texto. O conteúdo HTML não foi importado.",
  "Only the first 10 XML/PDF attachment parts are considered per message.": "São considerados os primeiros 10 anexos XML ou PDF por mensagem.",
  "An attachment exceeded the email import limits and was skipped.": "Um anexo ultrapassou os limites de importação de e-mail e foi ignorado.",
  "An attachment could not be identified and was skipped.": "Não foi possível identificar um anexo e ele foi ignorado.",
  "An invalid XML or PDF attachment was skipped.": "Um anexo XML ou PDF inválido foi ignorado.",
};

export function mailWarning(warning: string, translate: (source: string) => string) {
  if (warnings[warning]) return translate(warnings[warning]);
  const prefixes: [string, string][] = [
    ["Unsupported attachment skipped: ", "Anexo com formato não suportado ignorado"],
    ["Attachment skipped because the message reached its 10 MiB limit: ", "Anexo ignorado porque a mensagem atingiu o limite de 10 MiB"],
    ["Attachment skipped because it is empty or exceeds the 2 MiB file / 10 MiB message limit: ", "Anexo vazio ou acima do limite permitido ignorado"],
    ["Attachment skipped because its MIME metadata is inconsistent: ", "Anexo ignorado por inconsistência nos metadados MIME"],
  ];
  const match = prefixes.find(([prefix]) => warning.startsWith(prefix));
  return match ? `${translate(match[1])}: ${warning.slice(match[0].length)}` : warning;
}
