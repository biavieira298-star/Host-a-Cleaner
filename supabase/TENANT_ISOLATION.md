# Isolamento entre contas

Aplique a migração `202611170001_tenant_isolation.sql` no Supabase e publique a
versão correspondente do frontend de forma coordenada. A migração torna
privados os buckets `cleaning-photos` e `property-incidents`; o frontend passa
a obter URLs assinados, válidos durante uma hora, para as fotografias.
Clientes antigos que usem os URLs públicos deixam de conseguir abri-las.
O bucket `platform-documents` também fica privado: os documentos e respetivos
ficheiros são limitados ao `user_id` e à pasta do utilizador autenticado.
Documentos antigos sem `user_id` ou fora dessa pasta deixam de estar acessíveis;
audite e migre-os apenas depois de confirmar a propriedade de cada ficheiro.

As equipas e os registos de horas usam `owner_id` para identificar o admin.
Os registos de horas identificam o cleaner por `user_id`; não é necessária uma
coluna ou relação `team_member_id` nessa tabela. Se a coluna antiga existir
com uma restrição de não nulo, a migração permite novos registos sem ela.
Esta migração não converte automaticamente as ligações antigas nem remove
colunas, funções ou políticas antigas. Antes da implantação, faça uma cópia
de segurança, prepare os valores de `owner_id` após verificar cada associação
e remova manualmente as dependências antigas, incluindo quaisquer restrições
que impeçam novos registos. Sem essa preparação, os cleaners existentes podem
perder acesso e a gravação de horas pode falhar. As migrações históricas não
foram reescritas; não as execute novamente após essa limpeza.
A função Supabase `delete-team-member`, invocada pelo frontend, não tem código
neste repositório: verifique e atualize também a versão instalada no projeto.

Novos registos sem convite válido criam um perfil administrador `free`, com
os limites do plano gratuito. Um convite válido e ainda não utilizado liga a
conta à equipa e cria um perfil de cleaner. Um convite inválido ou expirado
resulta numa conta independente; o ecrã de registo informa dessa possibilidade.
Uma conta cleaner sem associação válida não abre os dados da aplicação.

O script cria as suas próprias funções auxiliares e pode ser executado novamente.
Pressupõe uma base Supabase com as tabelas da aplicação já existentes:
`profiles`, `team_members`, `properties`, `cleaning_tasks`,
`cleaning_task_photos`, `property_incidents`, `work_time_entries`,
`property_financial_entries` e `platform_documents`, com as colunas utilizadas
pela aplicação. Não é um instalador de uma base de dados vazia. As políticas
restritivas de isolamento complementam as políticas existentes para as
operações da aplicação; não as substituem todas.
As comparações de identificadores aceitam colunas UUID ou texto, mas os UUIDs
guardados como texto devem usar o formato canónico em minúsculas; valores
diferentes não são associados automaticamente.
Teste a migração num projeto de homologação com dois administradores e um membro
convidado antes de a aplicar em produção, incluindo o acesso às fotografias e
documentos e as operações normais de escrita.
Confirme também os triggers e políticas existentes nesse projeto: a migração
assume que os restantes triggers de criação de perfil são executados antes de
`zzz_initialize_tenant_profile`.

A migração não altera associações ou perfis antigos: a migração histórica de
convites associava contas existentes por email, pelo que essas associações
devem ser auditadas antes de serem corrigidas manualmente. Atribuições antigas
de alojamentos ou limpezas a membros de outra equipa também devem ser
corrigidas: a migração bloqueia a gravação dessas atribuições. Cópias ou URLs
já partilhados fora do Supabase não podem ser revogados por esta alteração.
As cópias offline anteriores são ignoradas; volte a iniciar sessão online para
criar uma nova cópia isolada por conta. Estas cópias permanecem armazenadas no
dispositivo e não substituem a proteção física de um dispositivo partilhado.
