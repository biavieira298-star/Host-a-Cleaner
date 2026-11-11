# Importação de relatórios de plataformas

Antes de disponibilizar esta versão da aplicação, aplique as migrações Supabase,
incluindo `202611110001_replace_platform_financial_entries.sql` e
`202611110002_link_platform_document_entries.sql`, e finalmente
`202611110003_document_scoped_financial_entries.sql`. A nova função SQL é
necessária para substituir e associar os movimentos numa única transação.
Sem a nova migração, a importação de ganhos falha e os movimentos anteriores
não são eliminados. A nova migração pressupõe que `platform_documents`
já existe no projeto Supabase.

Indique o mês obrigatório no formulário. Esse mês é atribuído a todos os
movimentos extraídos do PDF, independentemente das datas do documento.
Os imóveis são identificados pelos nomes no relatório.

A substituição afeta apenas os movimentos associados ao mesmo documento.
Documentos diferentes, mesmo da mesma plataforma e mês, mantêm os seus
movimentos e podem produzir valores duplicados se contiverem os mesmos dados.
Os lançamentos manuais e os movimentos sem documento associado são preservados.
O parâmetro RPC `p_extra_month` mantém-se por compatibilidade e deve ser nulo.

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
