# Importação de relatórios de plataformas

Antes de disponibilizar esta versão da aplicação, aplique as migrações Supabase,
incluindo `202611110001_replace_platform_financial_entries.sql` e
`202611110002_link_platform_document_entries.sql`. A nova função SQL é
necessária para substituir e associar os movimentos numa única transação.
Sem a nova migração, a importação de ganhos falha e os movimentos anteriores
não são eliminados. A nova migração pressupõe que `platform_documents`
já existe no projeto Supabase.

Indique o mês obrigatório no formulário. Esse mês é atribuído a todos os
movimentos extraídos do PDF, independentemente das datas do documento.
Os imóveis são identificados pelos nomes no relatório. Opcionalmente, indique
o mês incorreto onde uma importação anterior ficou registada.

Antes da substituição é pedida confirmação. São eliminadas as receitas do
utilizador com descrição iniciada por `Airbnb:` ou `Booking.com:`, conforme a
plataforma, em todos os imóveis e nos meses apresentados. Isto também inclui
eventuais lançamentos manuais com esse prefixo: os registos antigos não têm
um identificador de origem que permita distingui-los. A outra plataforma e
os restantes movimentos não são alterados. Confirme que o relatório contém
todos os movimentos dos meses em causa; um relatório parcial substituirá
igualmente os registos anteriores desses meses.

Se um imóvel identificado no documento não tiver correspondência, ou se uma
data necessária não puder ser determinada, a substituição é interrompida. O
documento já enviado permanece guardado, mas os movimentos antigos não são
alterados. A migração não corrige automaticamente importações anteriores.

Os movimentos de novas importações ficam associados ao documento. Ao eliminar
o documento, a base de dados elimina em cascata apenas os movimentos que ainda
lhe estão associados. Os movimentos importados antes desta ligação não podem
ser associados retroativamente com segurança e não são eliminados ao apagar
documentos antigos. Os CSV continuam a ser guardados como documentos sem
importação de movimentos.
