# Importação de relatórios de plataformas

Antes de disponibilizar esta versão da aplicação, aplique as migrações Supabase,
incluindo `202611110001_replace_platform_financial_entries.sql`. A função SQL é
necessária para substituir os movimentos numa única transação; sem ela, a
importação de ganhos falha e os movimentos anteriores não são eliminados.

Para PDFs Airbnb e Booking.com, o período é procurado no documento e, se
necessário, no nome do ficheiro. Se nenhum for identificado, indique o mês de
recurso no formulário. Opcionalmente, indique o mês incorreto onde uma
importação anterior ficou registada.

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
