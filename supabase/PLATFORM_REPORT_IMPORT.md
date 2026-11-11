# Importação de relatórios de plataformas

Antes de disponibilizar esta versão da aplicação, aplique as migrações Supabase,
incluindo `202611110001_replace_platform_financial_entries.sql` e
`202611110002_link_platform_document_entries.sql`, e finalmente
`202611110003_document_scoped_financial_entries.sql`, e
`202611110004_private_financial_storage.sql`. A nova função SQL é
necessária para substituir e associar os movimentos numa única transação.
Sem a nova migração, a importação de ganhos falha e os movimentos anteriores
não são eliminados. A nova migração pressupõe que `platform_documents`
já existe no projeto Supabase.

Indique o mês obrigatório no formulário. Esse mês é atribuído a todos os
movimentos extraídos do PDF, independentemente das datas do documento.
Os imóveis são identificados pelos nomes no relatório.

Na interface, apenas administradores podem aceder aos relatórios financeiros e
documentos. Se `profiles.can_view_financials` existir e for `false`, o acesso
também fica oculto para esse administrador. Se a coluna não existir, mantém-se
o comportamento anterior para administradores; erros na leitura do perfil
bloqueiam o acesso financeiro na interface. No modo offline é usada a última
permissão guardada; cópias antigas sem essa informação bloqueiam o acesso.

## Proteção dos ficheiros

A migração `202611110004` torna privados `platform-documents` e o bucket
antigo `hosting-reports`. Uma política restritiva aplica-se mesmo quando
existem outras políticas permissivas: exige autenticação, perfil autorizado
e uma pasta inicial igual ao ID do utilizador. Membros de limpeza/assistentes
e perfis com `can_view_financials = false` são recusados. Sem essa coluna,
aplica-se a verificação de papel e propriedade existente; se não houver perfil,
o Storage recusa o acesso. O bucket antigo mantém ainda as políticas que
verificam a propriedade do alojamento.

Para evitar que o próprio utilizador altere essas permissões, um trigger bloqueia
alterações autenticadas a `profiles.role` e `profiles.can_view_financials`, bem
como a eliminação autenticada do perfil. Essas operações passam a exigir um
processo privilegiado de administração; confirme a compatibilidade com os
processos de gestão de contas antes de aplicar a migração.

Os URLs públicos antigos deixam de funcionar após a mudança para privado;
o botão de descarregamento utiliza agora a sessão autenticada. URLs assinados
emitidos anteriormente podem continuar válidos até expirarem, e cópias ou
conteúdos em cache previamente descarregados não são revogados. A migração
abrange apenas estes dois buckets conhecidos: verifique outros buckets ou
pastas de faturas na instalação. As políticas das tabelas financeiras também
devem ser revistas separadamente; a política do Storage não protege as linhas.

Depois de aplicar a migração, teste com sessões reais: um administrador com
acesso deve listar, enviar, descarregar e apagar ficheiros na própria pasta;
um administrador com a permissão desativada, um membro da limpeza, outro
utilizador e uma sessão anónima não devem conseguir listar nem descarregar
esses ficheiros, incluindo pelo URL antigo. Confirme igualmente que outros
buckets continuam a funcionar. Execute os testes com credenciais reais e RLS,
sem usar a chave de serviço, que contorna as políticas.

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
