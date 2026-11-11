async function confirmStripePayment() {
    const title = document.getElementById('payment-title');
    const message = document.getElementById('payment-message');
    const spinner = document.getElementById('payment-spinner');
    const returnLink = document.getElementById('return-to-dashboard');
    const url = new URL(window.location.href);
    const sessionId = url.searchParams.get('session_id')?.trim();
    const dashboardUrl = new URL('./index.html', url);
    const translations = {
        pt: {
            loadingTitle: 'A confirmar o teu pagamento...',
            loadingMessage: 'Estamos a atualizar o teu plano. Aguarda um momento.',
            errorTitle: 'Não foi possível confirmar o pagamento',
            missing: 'O identificador do pagamento está em falta. Regressa ao painel e contacta o suporte se necessário.',
            signIn: 'Inicia sessão com a conta usada no pagamento para concluir a confirmação.',
            failed: 'Não foi possível atualizar o plano. Confirma que usas a conta do pagamento e recarrega esta página para tentar novamente.',
            success: 'Pagamento confirmado',
            active: 'ativo',
            trialing: 'em período de teste',
            returning: 'A regressar ao painel...',
            dashboard: 'Regressar ao painel'
        },
        en: {
            loadingTitle: 'Confirming your payment...',
            loadingMessage: 'We are updating your plan. Please wait.',
            errorTitle: 'Could not confirm your payment',
            missing: 'The payment session ID is missing. Return to the dashboard and contact support if needed.',
            signIn: 'Sign in with the account used for the payment to complete confirmation.',
            failed: 'Could not update your plan. Check that you are using the account used for payment and reload this page to retry.',
            success: 'Payment confirmed',
            active: 'active',
            trialing: 'in trial',
            returning: 'Returning to the dashboard...',
            dashboard: 'Return to dashboard'
        }
    };
    let lang = 'pt';
    try {
        if (localStorage.getItem('host_cleaner_lang') === 'en') lang = 'en';
    } catch (error) {
        console.warn('Não foi possível ler o idioma guardado:', error);
    }
    const text = translations[lang];
    document.documentElement.lang = lang;
    title.textContent = text.loadingTitle;
    message.textContent = text.loadingMessage;
    returnLink.textContent = text.dashboard;

    function showError(errorMessage) {
        title.textContent = text.errorTitle;
        message.textContent = errorMessage;
        spinner.hidden = true;
        returnLink.hidden = false;
    }

    if (!sessionId) {
        showError(text.missing);
        return;
    }

    try {
        const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        const { data: auth, error: authError } = await client.auth.getSession();
        if (authError) throw authError;
        if (!auth.session?.user) {
            dashboardUrl.searchParams.set('session_id', sessionId);
            returnLink.href = dashboardUrl.toString();
            showError(text.signIn);
            return;
        }

        const { data, error } = await client.functions.invoke('stripe-sync-subscription', {
            body: { session_id: sessionId }
        });
        if (error) throw error;
        const { data: currentAuth, error: currentAuthError } = await client.auth.getSession();
        if (currentAuthError) throw currentAuthError;
        if (currentAuth.session?.user?.id !== auth.session.user.id) {
            throw new Error('Authenticated account changed during synchronization');
        }
        const planLabels = { starter: 'Starter', pro: 'Pro', business: 'Business' };
        if (!data || !Object.hasOwn(planLabels, data.subscription_plan)
            || !['active', 'trialing'].includes(data.stripe_subscription_status)) {
            throw new Error('Invalid subscription synchronization response');
        }

        title.textContent = text.success;
        const status = data.stripe_subscription_status === 'trialing' ? text.trialing : text.active;
        message.textContent = `${lang === 'pt' ? 'Plano' : 'Plan'} ${planLabels[data.subscription_plan]} ${status}. ${text.returning}`;
        spinner.hidden = true;
        returnLink.hidden = false;
        try {
            localStorage.setItem('host_cleaner_active_tab', 'sub-subscriptions');
        } catch (error) {
            console.warn('Não foi possível guardar o separador do plano:', error);
        }
        window.setTimeout(() => window.location.replace(dashboardUrl.toString()), 2500);
    } catch (error) {
        console.error('Erro ao confirmar o pagamento Stripe:', error);
        showError(text.failed);
    }
}

void confirmStripePayment();
