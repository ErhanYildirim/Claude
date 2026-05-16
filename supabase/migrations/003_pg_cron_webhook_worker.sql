-- Webhook Worker pg_cron Zamanlaması
-- Supabase pg_cron extension'ı varsayılan olarak etkindir.
-- WEBHOOK_WORKER_SECRET ve Edge Function URL'sini ayarladıktan sonra
-- aşağıdaki komutu Supabase Dashboard → SQL Editor'da çalıştırın.
--
-- Not: <EDGE_FN_URL> = https://<project-ref>.supabase.co/functions/v1
--       <WORKER_SECRET> = Supabase Edge Function secrets'tan ayarlayın:
--       supabase secrets set WEBHOOK_WORKER_SECRET=<güçlü-rastgele-değer>

-- pg_cron ve pg_net extension'larının etkin olduğunu kontrol edin
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Mevcut zamanlamayı kaldır (idempotent)
SELECT cron.unschedule('webhook-worker') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'webhook-worker'
);

-- Her dakika webhook-worker Edge Function'ını çağır
SELECT cron.schedule(
  'webhook-worker',
  '* * * * *',
  $$
    SELECT net.http_post(
      url     := current_setting('app.edge_fn_url') || '/webhook-worker',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.webhook_worker_secret'),
        'Content-Type',  'application/json'
      ),
      body    := '{}'::jsonb
    )
  $$
);

-- app.edge_fn_url ve app.webhook_worker_secret'ı ayarla
-- Örnek (kendi değerlerinizle değiştirin):
-- ALTER DATABASE postgres SET app.edge_fn_url = 'https://qhqyyaosykzldbeuyjmq.supabase.co/functions/v1';
-- ALTER DATABASE postgres SET app.webhook_worker_secret = '<WEBHOOK_WORKER_SECRET>';
