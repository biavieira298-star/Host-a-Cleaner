# Configuração do webhook Stripe

A Edge Function `stripe-webhook` verifica a assinatura de cada evento Stripe e atualiza `profiles.subscription_plan`, `max_properties` e `max_cleaners`, além do estado, data de fim do período e cancelamento agendado. O utilizador é associado à subscrição através do ID autenticado incluído no Payment Link e só é atualizado quando o email de faturação coincide com o email da conta Host a Cleaner. A função ignora eventos antigos; em caso de falha de pagamento (`past_due`), mantém o plano durante as tentativas de cobrança do Stripe e só o altera quando a subscrição é cancelada ou termina.

## 1. Aplicar a migração

Aplicar as migrações `202611090001_stripe_subscription_webhook.sql` e `202611110005_stripe_checkout_order.sql` no projeto Supabase antes de implementar as funções. Acrescentam os IDs, o estado da subscrição e a data do checkout ao perfil.

## 2. Configurar segredos da função

Na configuração de secrets das Edge Functions do Supabase, definir:

- `STRIPE_SECRET_KEY`: chave secreta Stripe do mesmo modo (Test ou Live) que os Payment Links.
- `STRIPE_WEBHOOK_SECRET`: segredo de assinatura `whsec_` apresentado pelo Stripe para este endpoint.
- `STRIPE_PRICE_PLAN_MAP`: objeto JSON que associa cada Price ID recorrente Stripe ao plano. Incluir todos os preços mensais e anuais, por exemplo:

```json
{"price_id_starter_mensal":"starter","price_id_starter_anual":"starter","price_id_pro_mensal":"pro","price_id_pro_anual":"pro","price_id_business_mensal":"business","price_id_business_anual":"business"}
```

Os valores `price_id_...` são apenas marcadores: substituí-los pelos Price IDs reais (`price_...`) no Dashboard do Stripe. Nunca colocar chaves secretas no frontend ou neste ficheiro.

O Supabase disponibiliza `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` no ambiente das Edge Functions. A chave service role deve permanecer apenas no servidor.

## 3. Implementar e registar o endpoint

Aplicar a migração e implementar a função com a Supabase CLI:

```sh
supabase db push
supabase functions deploy stripe-webhook
supabase functions deploy stripe-sync-subscription
```

No Stripe Dashboard, criar um destino de webhook para:

```text
https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/stripe-webhook
```

Selecionar os eventos `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.updated` e `customer.subscription.deleted`. Guardar o signing secret desse destino como `STRIPE_WEBHOOK_SECRET`.

## 4. Configurar o retorno dos Payment Links

Em cada Payment Link de teste (Starter, Pro e Business), configurar **After payment → Redirect to your website** com:

```text
https://hostacleaner.com/?status=success
```

Esta configuração é feita no Stripe Dashboard e não pode ser imposta pelos links no frontend. O URL exato acima não inclui `session_id`, pelo que a atualização do plano depende do webhook `stripe-webhook`; confirme a entrega dos eventos no Dashboard do Stripe.

Se for necessário confirmar o pagamento imediatamente no regresso e permitir nova tentativa caso o webhook falhe, use antes `https://hostacleaner.com/status-success.html?session_id={CHECKOUT_SESSION_ID}` no Stripe. Esse URL alternativo não é o URL exato acima: o Stripe substitui o marcador pela sessão, que a página envia à função `stripe-sync-subscription`. Esta valida o token, a conta, o pagamento, a subscrição e os preços antes de atualizar o perfil. Ambas as funções usam os mesmos secrets e mapa de preços. A função de sincronização verifica o token explicitamente; `verify_jwt = false` desativa apenas a verificação do gateway. A sincronização não substitui o webhook para alterações e cancelamentos posteriores.

## 5. Testar antes de produção

Começar com a chave e os Payment Links `test_`. Fazer uma subscrição de teste Starter, Pro e Business com uma conta existente na app e o mesmo email da conta Host a Cleaner. Verificar o redirecionamento configurado, a entrega do webhook, a atualização do plano na interface e, no Supabase, os limites e IDs Stripe. Testar também um pagamento pendente e o cancelamento, verificando que o plano passa a Gratuito após `customer.subscription.deleted`. Se usar o URL alternativo com `session_id`, testar ainda uma sessão de outra conta e a recuperação de um webhook temporariamente indisponível.

Os links atuais são Payment Links de teste; a passagem para produção requer substituir os links no frontend por links Live, configurar os Price IDs Live e criar um endpoint Live com um novo signing secret. Nunca reutilizar os secrets de teste em produção.
