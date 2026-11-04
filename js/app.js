if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
    .then(reg => console.log('PWA Service Worker registado com sucesso!'))
    .catch(err => console.log('Erro ao registar PWA Service Worker:', err));
}

const SUPABASE_URL = 'https://prooebfvvwulpkfagnbg.supabase.co';
        const SUPABASE_KEY = 'sb_publishable_ctbII8i3aiWcdxY2Cj_WMQ_8BuQY3Rx';
        const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        let userRole = 'admin';
        let currentTeamMemberPreferences = { track_hours: false, require_photos: false };
        let currentTeamMemberId = null;
        let taskTeamMembers = [];
        let currentAuthMode = 'login';
        let currentUser = null;
        let pendingTeamInviteToken = null;
        let registrationRole = 'cleaner';
        let registrationRequested = false;
        let currentLang = localStorage.getItem('host_cleaner_lang') || 'pt';
        
        let selectedDate = new Date().toISOString().split('T')[0];
        let selectedPropertyFilter = 'all';
        let editingPropertyId = null;
        
        let calendarMode = 'week';
        let currentCalendarDate = new Date();
        let allTasksCache = [];
        let allPropertiesCache = [];
        let isDesktopSidebarCollapsed = false;
        let isMobileDrawerOpen = false;
        let selectedModalDate = null;

        // Dicionário de Traduções (PT / EN)
        const i18n = {
            pt: {
                login_subtitle: "Gestão inteligente e automatizada de alojamentos",
                btn_login_tab: "Fazer Login",
                btn_signup_tab: "Criar Conta",
                label_email: "Email",
                label_password: "Palavra-passe",
                btn_submit_login: "Entrar na Plataforma",
                btn_submit_signup: "Criar Nova Conta",
                btn_forgot_pwd: "Esqueceu-se da palavra-passe?",
                header_subtitle: "Acompanhe as limpezas e gira a sua equipa.",
                nav_cat_calendar: "📅 Calendário & Agendamento",
                nav_daily_tasks: "Tarefas Diárias (Lista)",
                nav_overview_cal: "Vista Semanal / Mensal",
                nav_settings: "Definições",
                nav_add_property: "Adicionar Alojamento",
                nav_manage_properties: "Gestão de Alojamento",
                nav_profile: "Perfil",
                nav_add_team: "Gestão de Equipa",
                team_track_hours: "Ativar registo de horas",
                team_require_photos: "Exigir fotos antes e depois",
                team_phone: "Telemóvel",
                team_phone_placeholder: "ex: +351 912 345 678",
                team_name: "Nome",
                team_whatsapp_invite: "Enviar acesso por WhatsApp",
                team_copy_link: "Copiar Link",
                team_link_copied: "Link copiado.",
                invite_signup_title: "Ativar acesso à equipa",
                invite_signup_subtitle: "Defina o email e a palavra-passe para entrar na PWA de Limpezas.",
                invite_signup_confirm_password: "Confirmar palavra-passe",
                invite_signup_submit: "Criar conta e entrar",
                nav_cat_history: "📜 Histórico & Pagamentos",
                nav_history_accounts: "Histórico & Contas",
                btn_sync_ical: "Sincronizar Agenda",
                btn_logout: "Sair da Conta",
                label_date: "Data:",
                opt_all_properties: "🏠 Todos os Alojamentos",
                btn_add_cleaning: "➕ Adicionar Limpeza",
                btn_prev: "◀ Anterior",
                btn_next: "Seguinte ▶",
                btn_mode_week: "Semanal",
                btn_mode_month: "Mensal",
                title_registered_properties: "Alojamentos Registados",
                title_add_property: "Adicionar Novo Alojamento",
                btn_cancel_edit: "Cancelar Edição",
                label_prop_name: "Nome do Imóvel",
                label_prop_address: "Morada Completa",
                label_prop_keybox: "Código Keybox / Acesso",
                label_prop_rate: "Valor por Hora (€/h)",
                label_prop_ical: "Link iCal do Airbnb / Booking (.ics)",
                label_prop_instructions: "Instruções Específicas de Limpeza",
                btn_save_property: "Guardar Alojamento",
                title_history: "Histórico de Serviços & Contas a Pagar",
                subtitle_history: "Cálculo automático de horas, valores e estado de pagamento",
                title_invite_member: "Convidar Membro para a Equipa",
                subtitle_invite_member: "Crie um convite para o membro definir o email e a palavra-passe no primeiro acesso.",
                btn_send_invite: "✉️ Criar Convite",
                title_team_list: "Membros da Sua Equipa",
                modal_add_cleaning_title: "Adicionar Limpeza",
                modal_add_cleaning_sub: "Selecione a listagem e o dia pretendido",
                label_select_prop: "1. Escolha a Listagem / Alojamento",
                label_select_date: "2. Escolha o Dia da Limpeza",
                label_notes_optional: "3. Observações / Instruções para a Equipa (Opcional)",
                btn_schedule_cleaning: "Agendar Limpeza",
                btn_cancel: "Cancelar",
                btn_close: "Fechar",
                label_notify_team: "📢 Notificar Funcionário / Equipa",
                btn_whatsapp: "💬 Enviar WhatsApp",
                btn_email: "✉️ Enviar Email",
                btn_delete_task: "🗑️ Apagar Limpeza",
                modal_profile_title: "Perfil de Utilizador",
                modal_profile_sub: "Gira os seus dados, segurança e licença da app",
                label_active_account: "Conta Ativa",
                tab_security: "🔒 Segurança & Acesso",
                tab_subscription: "💳 Plano & Subscrição",
                label_new_pwd: "Nova Palavra-passe",
                label_confirm_pwd: "Confirmar Nova Palavra-passe",
                btn_update_pwd: "Atualizar Palavra-passe",
                badge_comm_license: "Licença Comercial",
                badge_active: "🟢 Ativa",
                plan_title: "Plano Profissional (29.00€/mês)",
                plan_desc: "Acesso ilimitado a alojamentos, sincronização iCal automática e gestão de equipa.",
                btn_stripe_portal: "💳 Abrir Portal de Pagamento Stripe"
            },
            en: {
                login_subtitle: "Smart & automated rental property management",
                btn_login_tab: "Log In",
                btn_signup_tab: "Sign Up",
                label_email: "Email",
                label_password: "Password",
                btn_submit_login: "Log In to Platform",
                btn_submit_signup: "Create New Account",
                btn_forgot_pwd: "Forgot password?",
                header_subtitle: "Track cleanings and manage your team.",
                nav_cat_calendar: "📅 Calendar & Schedule",
                nav_daily_tasks: "Daily Tasks (List)",
                nav_overview_cal: "Weekly / Monthly View",
                nav_settings: "Settings",
                nav_add_property: "Add Property",
                nav_manage_properties: "Property Management",
                nav_profile: "Profile",
                nav_add_team: "Team Management",
                team_track_hours: "Enable time tracking",
                team_require_photos: "Require before and after photos",
                team_phone: "Phone number",
                team_phone_placeholder: "e.g. +351 912 345 678",
                team_name: "Name",
                team_whatsapp_invite: "Send access via WhatsApp",
                team_copy_link: "Copy Link",
                team_link_copied: "Link copied.",
                invite_signup_title: "Activate team access",
                invite_signup_subtitle: "Set your email and password to access the Cleaning PWA.",
                invite_signup_confirm_password: "Confirm password",
                invite_signup_submit: "Create account and continue",
                nav_cat_history: "📜 History & Billing",
                nav_history_accounts: "History & Accounts",
                btn_sync_ical: "Sync Calendar Now",
                btn_logout: "Log Out",
                label_date: "Date:",
                opt_all_properties: "🏠 All Properties",
                btn_add_cleaning: "➕ Add Cleaning",
                btn_prev: "◀ Previous",
                btn_next: "Next ▶",
                btn_mode_week: "Weekly",
                btn_mode_month: "Monthly",
                title_registered_properties: "Registered Properties",
                title_add_property: "Add New Property",
                btn_cancel_edit: "Cancel Edit",
                label_prop_name: "Property Name",
                label_prop_address: "Full Address",
                label_prop_keybox: "Keybox / Access Code",
                label_prop_rate: "Hourly Rate (€/h)",
                label_prop_ical: "Airbnb / Booking iCal Link (.ics)",
                label_prop_instructions: "Specific Cleaning Instructions",
                btn_save_property: "Save Property",
                title_history: "Service History & Accounts Payable",
                subtitle_history: "Automatic calculation of hours, amounts and payment status",
                title_invite_member: "Invite Team Member",
                subtitle_invite_member: "Create an invite so the team member can set an email and password on first access.",
                btn_send_invite: "✉️ Create Invite",
                title_team_list: "Your Team Members",
                modal_add_cleaning_title: "Add Cleaning",
                modal_add_cleaning_sub: "Select property and date",
                label_select_prop: "1. Select Property",
                label_select_date: "2. Select Cleaning Date",
                label_notes_optional: "3. Notes / Instructions for Team (Optional)",
                btn_schedule_cleaning: "Schedule Cleaning",
                btn_cancel: "Cancel",
                btn_close: "Close",
                label_notify_team: "📢 Notify Staff / Team",
                btn_whatsapp: "💬 Send WhatsApp",
                btn_email: "✉️ Send Email",
                btn_delete_task: "🗑️ Delete Task",
                modal_profile_title: "User Profile",
                modal_profile_sub: "Manage your data, security and app license",
                label_active_account: "Active Account",
                tab_security: "🔒 Security & Access",
                tab_subscription: "💳 Plan & Subscription",
                label_new_pwd: "New Password",
                label_confirm_pwd: "Confirm New Password",
                btn_update_pwd: "Update Password",
                badge_comm_license: "Commercial License",
                badge_active: "🟢 Active",
                plan_title: "Professional Plan (€29.00/mo)",
                plan_desc: "Unlimited properties, automatic iCal sync and team management.",
                btn_stripe_portal: "💳 Open Stripe Payment Portal"
            }
        };

        // Função de Alternância de Visibilidade da Palavra-passe
        function togglePasswordVisibility(inputId, eyeIconId) {
            const input = document.getElementById(inputId);
            const icon = document.getElementById(eyeIconId);
            if (!input) return;

            if (input.type === "password") {
                input.type = "text";
                if (icon) icon.innerText = "🙈";
            } else {
                input.type = "password";
                if (icon) icon.innerText = "👁️";
            }
        }

        // Função para Mudar de Idioma
        function changeLanguage(lang) {
            currentLang = lang;
            localStorage.setItem('host_cleaner_lang', lang);

            // Sincroniza seletores
            document.querySelectorAll('#lang-select-login, #lang-select-mobile, #lang-select-desktop').forEach(sel => {
                if (sel) sel.value = lang;
            });

            // Atualiza todos os elementos marcados com data-i18n
            document.querySelectorAll('[data-i18n]').forEach(el => {
                const key = el.getAttribute('data-i18n');
                if (i18n[lang] && i18n[lang][key]) {
                    el.innerText = i18n[lang][key];
                }
            });

            // Re-renderiza o calendário para atualizar os dias da semana
            if (!document.getElementById('view-sub-calendar-overview').classList.contains('hidden')) {
                renderOverviewCalendar();
            }
        }

        async function initApp() {
            changeLanguage(currentLang);
            document.getElementById('calendar-date-picker').value = selectedDate;
            const { data: { session } } = await supabaseClient.auth.getSession();
            currentUser = session ? session.user : null;

            if (pendingTeamInviteToken) {
                showTeamInviteSignup();
            } else if (registrationRequested) {
                showLoginScreen();
                setAuthMode('signup');
            } else if (currentUser) {
                await checkUserRole();
                showAppLayout();
                window.clearTimeout(window.__appStartupFallback);
                document.documentElement.classList.remove('app-loading');
                await loadData();
            } else {
                showLoginScreen();
            }

            supabaseClient.auth.onAuthStateChange(async (event, session) => {
                currentUser = session ? session.user : null;
                if (registrationRequested && event === 'INITIAL_SESSION') return;
                if (currentUser) {
                    await checkUserRole();
                    showAppLayout();
                    loadData();
                } else {
                    showLoginScreen();
                }
            });
        }

        async function checkUserRole() {
            if (!currentUser) return;
            const { data, error } = await supabaseClient.from('team_members').select('*').eq('auth_user_id', currentUser.id).maybeSingle();
            if (error) {
                console.error('Erro ao carregar o perfil do membro da equipa:', error);
                throw error;
            }
            if (data && data.role === 'cleaner') {
                userRole = 'cleaner';
                currentTeamMemberId = data.id;
                currentTeamMemberPreferences = {
                    track_hours: data.track_hours === true,
                    require_photos: data.require_photos === true
                };
            } else {
                userRole = 'admin';
                currentTeamMemberId = null;
                currentTeamMemberPreferences = { track_hours: false, require_photos: false };
            }
        }

        function applyRolePermissionsUI() {
            const adminElements = document.querySelectorAll('.admin-only');
            if (userRole === 'cleaner') {
                adminElements.forEach(el => el.classList.add('hidden'));
                document.getElementById('sidebar-role-subtitle').innerText = "Equipa de Limpeza";
                document.getElementById('profile-role-badge').innerText = "Limpeza";
            } else {
                adminElements.forEach(el => el.classList.remove('hidden'));
                document.getElementById('sidebar-role-subtitle').innerText = "Admin Hub";
                document.getElementById('profile-role-badge').innerText = "Admin";
            }
        }

        function toggleMobileDrawer() {
            const sidebar = document.getElementById('sidebar-menu');
            const backdrop = document.getElementById('mobile-backdrop');
            isMobileDrawerOpen = !isMobileDrawerOpen;

            if (isMobileDrawerOpen) {
                sidebar.classList.remove('-translate-x-full');
                sidebar.classList.add('translate-x-0');
                backdrop.classList.remove('hidden');
            } else {
                sidebar.classList.remove('translate-x-0');
                sidebar.classList.add('-translate-x-full');
                backdrop.classList.add('hidden');
            }
        }

        function toggleSettingsMenu(forceOpen) {
            const menu = document.getElementById('settings-menu-items');
            const button = document.getElementById('btn-settings-menu');
            const chevron = document.getElementById('settings-menu-chevron');
            const isOpen = forceOpen ?? menu.classList.contains('hidden');

            menu.classList.toggle('hidden', !isOpen);
            button.setAttribute('aria-expanded', String(isOpen));
            chevron.classList.toggle('rotate-180', isOpen);
        }

        function toggleDesktopSidebar() {
            const sidebar = document.getElementById('sidebar-menu');
            const btn = document.getElementById('sidebar-toggle-btn');
            const texts = document.querySelectorAll('.sidebar-text');

            isDesktopSidebarCollapsed = !isDesktopSidebarCollapsed;

            if (isDesktopSidebarCollapsed) {
                sidebar.classList.remove('md:w-72');
                sidebar.classList.add('md:w-20');
                btn.innerText = '▶';
                texts.forEach(el => el.classList.add('hidden'));
            } else {
                sidebar.classList.remove('md:w-20');
                sidebar.classList.add('md:w-72');
                btn.innerText = '◀';
                texts.forEach(el => el.classList.remove('hidden'));
            }
        }

        function closeMenuAfterAction() {
            if (window.innerWidth < 768 && isMobileDrawerOpen) {
                toggleMobileDrawer();
            }
        }

        function setAuthMode(mode) {
            currentAuthMode = mode;
            document.getElementById('btn-mode-login').className = mode === 'login' ? "flex-1 py-2.5 rounded-xl bg-white text-indigo-600 shadow-sm transition" : "flex-1 py-2.5 rounded-xl text-slate-500 transition";
            document.getElementById('btn-mode-signup').className = mode === 'signup' ? "flex-1 py-2.5 rounded-xl bg-white text-indigo-600 shadow-sm transition" : "flex-1 py-2.5 rounded-xl text-slate-500 transition";
            document.getElementById('auth-submit-btn').innerText = mode === 'login' ? i18n[currentLang].btn_submit_login : i18n[currentLang].btn_submit_signup;
            const nameInput = document.getElementById('auth-name');
            document.getElementById('auth-name-field').classList.toggle('hidden', mode !== 'signup');
            nameInput.required = mode === 'signup';
            document.getElementById('auth-message').classList.add('hidden');
        }

        function mostrarMensagemAuth(message, type) {
            const element = document.getElementById('auth-message');
            element.innerText = message;
            element.className = `text-center text-xs font-semibold ${type === 'error' ? 'text-red-600' : 'text-emerald-700'}`;
            element.setAttribute('role', type === 'error' ? 'alert' : 'status');
        }

        async function registarUtilizador(email, password, nome, role) {
            const { data, error } = await supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: 'https://host-a-cleaner.pages.dev/#login',
                    data: {
                        full_name: nome,
                        role
                    }
                }
            });
            if (error) throw error;
            return data;
        }

        async function handleAuthSubmit(e) {
            e.preventDefault();
            const email = document.getElementById('auth-email').value.trim();
            const password = document.getElementById('auth-password').value;
            const submitBtn = document.getElementById('auth-submit-btn');
            submitBtn.disabled = true;

            try {
                if (currentAuthMode === 'login') {
                    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
                    if (error) throw error;
                } else {
                    const nome = document.getElementById('auth-name').value.trim();
                    const data = await registarUtilizador(email, password, nome, registrationRole);
                    mostrarMensagemAuth(
                        data.session
                            ? 'Conta criada com sucesso!'
                            : 'Conta criada com sucesso. Confirme o seu email para ativar a conta.',
                        'success'
                    );
                }
            } catch (error) {
                mostrarMensagemAuth(
                    `${currentAuthMode === 'login' ? 'Erro ao entrar' : 'Erro ao criar conta'}: ${error.message}`,
                    'error'
                );
            } finally {
                submitBtn.disabled = false;
            }
        }

        function showTeamInviteSignup() {
            document.getElementById('section-login').classList.add('hidden');
            document.getElementById('app-layout').classList.add('hidden');
            document.getElementById('team-invite-signup').classList.remove('hidden');
        }

        async function handleTeamInviteSignup(event) {
            event.preventDefault();
            const message = document.getElementById('team-invite-signup-message');
            const button = document.getElementById('btn-team-invite-signup');
            const email = document.getElementById('invite-signup-email').value.trim();
            const password = document.getElementById('invite-signup-password').value;
            const confirmation = document.getElementById('invite-signup-password-confirm').value;

            if (currentUser) {
                message.innerText = 'Já existe uma sessão iniciada neste browser. Termine a sessão e volte a abrir o convite, ou use uma janela privada.';
                message.classList.remove('hidden');
                return;
            }
            if (!pendingTeamInviteToken) {
                message.innerText = 'Este convite não é válido ou já foi utilizado. Peça um novo link ao administrador.';
                message.classList.remove('hidden');
                return;
            }
            if (password !== confirmation) {
                message.innerText = 'As palavras-passe não coincidem.';
                message.classList.remove('hidden');
                return;
            }

            button.disabled = true;
            message.classList.add('hidden');
            try {
                const redirectUrl = new URL(window.location.href);
                redirectUrl.searchParams.delete('invite');
                redirectUrl.hash = '';
                const { data, error } = await supabaseClient.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: redirectUrl.toString(),
                        data: { team_invite_token: pendingTeamInviteToken }
                    }
                });
                if (error) throw error;

                pendingTeamInviteToken = null;
                window.history.replaceState({}, document.title, redirectUrl.toString());
                if (data.session) {
                    message.innerText = 'Conta criada. A carregar o seu acesso...';
                } else {
                    message.innerText = 'Conta criada. Confirme o email para ativar o acesso à equipa.';
                }
                message.classList.remove('hidden');
            } catch (error) {
                console.error('Erro ao aceitar convite da equipa:', error);
                message.innerText = `Não foi possível criar a conta: ${error.message}`;
                message.classList.remove('hidden');
            } finally {
                button.disabled = false;
            }
        }

        async function handleForgotPassword() {
            const email = prompt('Introduza o seu email para receber as instruções de recuperação:');
            if (!email) return;
            const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.href
            });
            if (error) alert('Erro ao enviar email: ' + error.message);
            else alert('Email de recuperação enviado! Verifique a sua caixa de entrada.');
        }

        function showLoginScreen() {
            document.getElementById('team-invite-signup').classList.add('hidden');
            document.getElementById('section-login').classList.remove('hidden');
            document.getElementById('app-layout').classList.add('hidden');
        }

        function showAppLayout() {
            document.getElementById('team-invite-signup').classList.add('hidden');
            document.getElementById('section-login').classList.add('hidden');
            document.getElementById('app-layout').classList.remove('hidden');
            document.getElementById('user-email-display').innerText = currentUser?.email || 'Utilizador';

            applyRolePermissionsUI();
            
            const savedTab = localStorage.getItem('host_cleaner_active_tab') || 'sub-calendar-daily';
            const adminTabs = ['sub-properties-add', 'sub-team-management'];
            if (userRole === 'cleaner' && adminTabs.includes(savedTab)) {
                switchTab('sub-calendar-daily');
            } else {
                switchTab(savedTab);
            }
        }

        async function handleLogout() {
            localStorage.removeItem('host_cleaner_active_tab');
            await supabaseClient.auth.signOut();
            currentUser = null; userRole = 'admin'; showLoginScreen();
        }

        function openProfileModal() {
            closeMenuAfterAction();
            document.getElementById('profile-email-val').innerText = currentUser?.email || '---';
            document.getElementById('new-password-input').value = '';
            document.getElementById('confirm-password-input').value = '';
            switchProfileTab('security');
            document.getElementById('profile-modal').classList.remove('hidden');
        }

        function closeProfileModal() {
            document.getElementById('profile-modal').classList.add('hidden');
        }

        function switchProfileTab(tab) {
            const secTab = document.getElementById('profile-subtab-security');
            const subTab = document.getElementById('profile-subtab-subscription');
            const btnSec = document.getElementById('btn-profile-tab-security');
            const btnSub = document.getElementById('btn-profile-tab-subscription');

            if (tab === 'security') {
                secTab.classList.remove('hidden');
                subTab.classList.add('hidden');
                btnSec.className = "flex-1 py-2 rounded-lg bg-white text-indigo-600 shadow-sm transition";
                btnSub.className = "admin-only flex-1 py-2 rounded-lg text-slate-500 transition";
            } else {
                secTab.classList.add('hidden');
                subTab.classList.remove('hidden');
                btnSec.className = "flex-1 py-2 rounded-lg text-slate-500 transition";
                btnSub.className = "admin-only flex-1 py-2 rounded-lg bg-white text-indigo-600 shadow-sm transition";
            }
        }

        async function handleChangePassword(e) {
            e.preventDefault();
            const newPassword = document.getElementById('new-password-input').value;
            const confirmPassword = document.getElementById('confirm-password-input').value;

            if (newPassword !== confirmPassword) {
                alert('As palavras-passe introduzidas não coincidem.');
                return;
            }

            const btn = document.getElementById('btn-update-pwd');
            btn.disabled = true;
            btn.innerText = 'A atualizar...';

            const { error } = await supabaseClient.auth.updateUser({ password: newPassword });

            if (error) {
                alert('Erro ao alterar a palavra-passe: ' + error.message);
            } else {
                alert('Palavra-passe alterada com sucesso!');
                closeProfileModal();
            }

            btn.disabled = false;
            btn.innerText = i18n[currentLang].btn_update_pwd;
        }

        function switchTab(subtabId) {
            closeMenuAfterAction();
            
            const adminTabs = ['sub-properties-add', 'sub-team-management'];
            if (userRole === 'cleaner' && adminTabs.includes(subtabId)) {
                subtabId = 'sub-calendar-daily';
            }

            if (['sub-properties-list', 'sub-properties-add', 'sub-team-management'].includes(subtabId)) {
                toggleSettingsMenu(true);
            }

            localStorage.setItem('host_cleaner_active_tab', subtabId);

            const tabs = ['sub-calendar-daily', 'sub-calendar-overview', 'sub-properties-list', 'sub-properties-add', 'sub-history', 'sub-team-management'];
            tabs.forEach(t => {
                const el = document.getElementById(`view-${t}`);
                if (el) el.classList.toggle('hidden', t !== subtabId);
                const btn = document.getElementById(`btn-${t}`);
                if (btn) {
                    if (t === subtabId) {
                        btn.className = "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white shadow-lg transition whitespace-nowrap";
                    } else {
                        btn.className = "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition whitespace-nowrap";
                    }
                }
            });

            if (subtabId === 'sub-calendar-daily') fetchTasks();
            if (subtabId === 'sub-calendar-overview') renderOverviewCalendar();
            if (subtabId === 'sub-properties-list') fetchProperties();
            if (subtabId === 'sub-history') fetchHistoryAdmin();
            if (subtabId === 'sub-team-management') fetchTeamMembers();
        }

        async function loadData() {
            await fetchPropertiesForSelect();
            await fetchProperties();
            await fetchAllTasksCache();
            fetchTasks();
            if (!document.getElementById('view-sub-calendar-overview').classList.contains('hidden')) {
                renderOverviewCalendar();
            }
        }

        async function fetchAllTasksCache() {
            let { data } = await supabaseClient.from('cleaning_tasks').select(`*, properties!inner(name, address, access_code, instructions, hourly_rate, user_id)`);
            allTasksCache = data || [];
        }

        async function fetchPropertiesForSelect() {
            const filterSelect = document.getElementById('filter-property-select');
            let { data } = await supabaseClient.from('properties').select('*');
            allPropertiesCache = data || [];

            if (filterSelect) {
                filterSelect.innerHTML = `<option value="all">${i18n[currentLang].opt_all_properties}</option>` + allPropertiesCache.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
                filterSelect.value = selectedPropertyFilter;
            }
        }

        async function fetchProperties() {
            const gridEl = document.getElementById('properties-grid');
            if (!gridEl) return;

            const { data, error } = await supabaseClient.from('properties').select('*').order('created_at', { ascending: false });

            if (error) {
                console.error('Erro ao carregar alojamentos:', error);
                gridEl.innerHTML = `<p class="text-rose-600 text-xs col-span-full">Erro ao carregar alojamentos: ${error.message}</p>`;
                return;
            }

            if (!data || data.length === 0) {
                gridEl.innerHTML = `<p class="text-slate-400 text-xs col-span-full">Ainda não tem alojamentos registados.</p>`;
                return;
            }

            gridEl.innerHTML = data.map(prop => `
                <div class="border border-slate-200/80 bg-slate-50 p-5 rounded-2xl space-y-3 relative group hover:border-indigo-300 transition">
                    <div class="flex justify-between items-start">
                        <div>
                            <h4 class="font-bold text-slate-900 text-sm">${prop.name}</h4>
                            <p class="text-xs text-slate-500">${prop.address || 'Sem morada'}</p>
                        </div>
                        ${userRole === 'admin' ? `
                            <div class="flex items-center gap-1">
                                <button type="button" data-property-id="${prop.id}" title="Editar" aria-label="Editar ${prop.name}" class="edit-property-button p-2 text-slate-400 hover:text-indigo-600 transition">✏️</button>
                                <button type="button" data-property-id="${prop.id}" title="Apagar" aria-label="Apagar ${prop.name}" class="delete-property-button p-2 text-slate-400 hover:text-rose-600 transition">🗑️</button>
                            </div>
                        ` : ''}
                    </div>
                    <div class="flex items-center gap-2 flex-wrap text-[11px]">
                        <span class="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg font-bold border border-indigo-100">🔑 Keybox: ${prop.access_code || 'N/A'}</span>
                        <span class="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg font-bold border border-emerald-100">💶 ${prop.hourly_rate || 10.00}€/h</span>
                    </div>
                    ${userRole === 'admin' ? `<div class="text-[10px] text-emerald-700 font-mono truncate bg-white p-2 rounded-lg border border-slate-200">🔗 ${prop.ical_url || 'Sem link iCal'}</div>` : ''}
                </div>
            `).join('');

            gridEl.querySelectorAll('.edit-property-button').forEach(button => {
                button.addEventListener('click', () => {
                    const property = data.find(item => String(item.id) === button.dataset.propertyId);
                    if (property) loadPropertyForEdit(property);
                });
            });
            gridEl.querySelectorAll('.delete-property-button').forEach(button => {
                button.addEventListener('click', () => deleteProperty(button.dataset.propertyId));
            });
        }

        function loadPropertyForEdit(property) {
            editingPropertyId = property.id;
            document.getElementById('prop-name').value = property.name || '';
            document.getElementById('prop-address').value = property.address || '';
            document.getElementById('prop-access').value = property.access_code || '';
            document.getElementById('prop-ical').value = property.ical_url || '';
            document.getElementById('prop-instructions').value = property.instructions || '';
            document.getElementById('prop-rate').value = property.hourly_rate || 10;

            document.getElementById('property-form-title').innerText = "Editar Alojamento";
            document.getElementById('cancel-edit-btn').classList.remove('hidden');

            const submitBtn = document.getElementById('prop-submit-btn');
            submitBtn.innerText = "Atualizar Alojamento";
            submitBtn.className = "md:col-span-2 bg-amber-500 hover:bg-amber-600 text-white font-bold p-3.5 rounded-xl text-xs transition shadow-lg shadow-amber-500/20";
            
            switchTab('sub-properties-add');
        }

        function resetPropertyForm() {
            editingPropertyId = null;
            document.getElementById('property-form').reset();
            document.getElementById('prop-rate').value = "10.00";
            document.getElementById('property-form-title').innerText = i18n[currentLang].title_add_property;
            document.getElementById('cancel-edit-btn').classList.add('hidden');

            const submitBtn = document.getElementById('prop-submit-btn');
            submitBtn.innerText = i18n[currentLang].btn_save_property;
            submitBtn.className = "md:col-span-2 gradient-bg hover:opacity-95 text-white font-bold p-3.5 rounded-xl text-xs transition shadow-lg shadow-indigo-500/30";
        }

        async function deleteProperty(propId) {
            if (!confirm('Deseja mesmo apagar este alojamento?')) return;
            const { error } = await supabaseClient.from('properties').delete().eq('id', propId);
            if (error) {
                alert('Erro ao apagar alojamento: ' + error.message);
                return;
            }
            await loadData();
        }

        function onCalendarPropertyFilterChange(val) { selectedPropertyFilter = val; fetchTasks(); }
        function onDateFilterChange(val) { if (val) { selectedDate = val; fetchTasks(); } }

        async function fetchTasks() {
            const container = document.getElementById('tasks-list-container');
            if (!container) return;

            let filtered = allTasksCache.filter(task => {
                const matchDate = task.scheduled_date === selectedDate;
                const matchProp = selectedPropertyFilter === 'all' || task.property_id === selectedPropertyFilter;
                return matchDate && matchProp;
            });

            if (filtered.length === 0) {
                container.innerHTML = `
                    <div class="py-6 text-center space-y-3">
                        <p class="text-slate-400 text-xs">Sem limpezas agendadas para esta data.</p>
                        ${userRole === 'admin' ? `
                            <button onclick="openAddCleaningModal('${selectedDate}')" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-4 py-2 rounded-xl text-xs border border-indigo-200 transition">
                                ➕ Adicionar Limpeza para ${selectedDate}
                            </button>
                        ` : ''}
                    </div>
                `;
                return;
            }

            container.innerHTML = filtered.map(task => `
                <div onclick='openTaskModal(${JSON.stringify(task)})' class="border border-slate-200/80 bg-slate-50 hover:bg-white p-4 rounded-2xl flex items-center justify-between cursor-pointer transition shadow-sm hover:border-indigo-300">
                    <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center text-xs shrink-0">🧹</div>
                        <div>
                            <h4 class="font-bold text-slate-900 text-xs">${task.properties?.name || 'Alojamento'}</h4>
                            <p class="text-[11px] text-slate-500">📍 ${task.properties?.address || 'Sem morada'}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-3 shrink-0">
                        <span class="text-[11px] font-bold px-2.5 py-1 rounded-full ${task.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : task.status === 'in_progress' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'}">
                            ${task.status === 'completed' ? '🟢 Concluída' : task.status === 'in_progress' ? '🔄 Em Andamento' : '⏳ Pendente'}
                        </span>
                    </div>
                </div>
            `).join('');
        }

        function openAddCleaningModal(defaultDate) {
            const propSelect = document.getElementById('modal-cleaning-prop');
            if (allPropertiesCache.length === 0) {
                propSelect.innerHTML = `<option value="">Nenhum alojamento registado</option>`;
            } else {
                propSelect.innerHTML = allPropertiesCache.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
            }

            document.getElementById('modal-cleaning-date').value = defaultDate || selectedDate;
            document.getElementById('modal-cleaning-notes').value = '';
            document.getElementById('add-cleaning-modal').classList.remove('hidden');
        }

        function closeAddCleaningModal() {
            document.getElementById('add-cleaning-modal').classList.add('hidden');
        }

        async function handleAddCleaningSubmit(e) {
            e.preventDefault();
            const property_id = document.getElementById('modal-cleaning-prop').value;
            const scheduled_date = document.getElementById('modal-cleaning-date').value;
            const cleaner_notes = document.getElementById('modal-cleaning-notes').value;

            if (!property_id) {
                alert('Por favor, selecione um alojamento.');
                return;
            }

            const btn = document.getElementById('btn-submit-add-cleaning');
            btn.disabled = true;
            btn.innerText = 'A agendar...';

            const { error } = await supabaseClient.from('cleaning_tasks').insert([{
                property_id,
                scheduled_date,
                status: 'pending',
                cleaner_notes: cleaner_notes ? `[Manual] ${cleaner_notes}` : '[Manual]'
            }]);

            if (error) {
                alert('Erro ao agendar limpeza: ' + error.message);
            } else {
                alert('Limpeza adicionada com sucesso!');
                closeAddCleaningModal();
                selectedDate = scheduled_date;
                document.getElementById('calendar-date-picker').value = scheduled_date;
                await loadData();
            }

            btn.disabled = false;
            btn.innerText = i18n[currentLang].btn_schedule_cleaning;
        }

        function openDayTasksModal(dateStr) {
            selectedModalDate = dateStr;
            document.getElementById('day-modal-title').innerText = `Limpezas do Dia`;
            document.getElementById('day-modal-date-subtitle').innerText = `📅 ${dateStr}`;

            const container = document.getElementById('day-modal-tasks-container');
            const dayTasks = allTasksCache.filter(t => t.scheduled_date === dateStr);

            if (dayTasks.length === 0) {
                container.innerHTML = `<p class="text-slate-400 text-xs py-2">Nenhuma limpeza registada para esta data.</p>`;
            } else {
                container.innerHTML = dayTasks.map(task => `
                    <div onclick='openTaskModal(${JSON.stringify(task)})' class="border border-slate-200 bg-slate-50 hover:bg-white p-3 rounded-xl flex justify-between items-center cursor-pointer transition">
                        <div>
                            <strong class="text-xs text-slate-900 block">${task.properties?.name || 'Alojamento'}</strong>
                            <span class="text-[10px] text-slate-500">📍 ${task.properties?.address || '---'}</span>
                            ${task.cleaner_notes ? `<span class="text-[10px] text-slate-600 block mt-1">📝 ${task.cleaner_notes}</span>` : ''}
                        </div>
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${task.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}">
                            ${task.status === 'completed' ? '🟢 Concluída' : '⏳ Pendente'}
                        </span>
                    </div>
                `).join('');
            }

            document.getElementById('day-tasks-modal').classList.remove('hidden');
        }

        function closeDayTasksModal() {
            document.getElementById('day-tasks-modal').classList.add('hidden');
        }

        function renderTaskPermissionModules(task, preferences) {
            return `
                ${preferences.require_photos ? `
                    <div class="space-y-2 pt-2 border-t border-slate-100">
                        <label class="block font-bold text-slate-700">📸 Fotografias do Imóvel</label>
                        <div class="grid grid-cols-2 gap-3">
                            <div class="border border-dashed border-slate-300 p-2.5 rounded-xl text-center space-y-2 bg-slate-50">
                                <span class="block font-bold text-[11px] text-slate-600">Entrada (Antes)</span>
                                ${task.photo_before_url ? `
                                    <a href="${task.photo_before_url}" target="_blank" rel="noopener" class="block">
                                        <img src="${task.photo_before_url}" class="w-full h-24 object-cover rounded-lg border border-slate-200">
                                    </a>
                                ` : `
                                    <label class="cursor-pointer block bg-white border border-slate-200 p-2 rounded-lg text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 transition">
                                        📷 Tirar Foto
                                        <input type="file" accept="image/*" capture="environment" class="hidden" onchange="uploadTaskPhoto(event, '${task.id}', 'photo_before_url')">
                                    </label>
                                `}
                            </div>
                            <div class="border border-dashed border-slate-300 p-2.5 rounded-xl text-center space-y-2 bg-slate-50">
                                <span class="block font-bold text-[11px] text-slate-600">Saída (Depois)</span>
                                ${task.photo_after_url ? `
                                    <a href="${task.photo_after_url}" target="_blank" rel="noopener" class="block">
                                        <img src="${task.photo_after_url}" class="w-full h-24 object-cover rounded-lg border border-slate-200">
                                    </a>
                                ` : `
                                    <label class="cursor-pointer block bg-white border border-slate-200 p-2 rounded-lg text-[10px] font-bold text-emerald-600 hover:bg-emerald-50 transition">
                                        📷 Tirar Foto
                                        <input type="file" accept="image/*" capture="environment" class="hidden" onchange="uploadTaskPhoto(event, '${task.id}', 'photo_after_url')">
                                    </label>
                                `}
                            </div>
                        </div>
                    </div>
                ` : ''}
                ${preferences.track_hours ? `
                    <div class="space-y-2 pt-2 border-t border-slate-100">
                        <label for="modal-hours-${task.id}" class="block font-bold text-slate-700">Horas Gastas</label>
                        <input type="number" step="0.5" id="modal-hours-${task.id}" value="${task.hours_spent || ''}" placeholder="ex: 2.5" class="w-full border border-slate-200 p-2.5 rounded-xl text-xs bg-white">
                    </div>
                ` : ''}
            `;
        }

        async function openTaskModal(task) {
            document.getElementById('modal-prop-name').innerText = task.properties?.name || 'Detalhes da Limpeza';
            
            const deleteBtn = document.getElementById('btn-delete-task-modal');
            if (userRole === 'admin') {
                deleteBtn.classList.remove('hidden');
                deleteBtn.onclick = () => deleteTask(task.id);
            } else {
                deleteBtn.classList.add('hidden');
            }

            const btnWhatsapp = document.getElementById('btn-whatsapp-notify');
            const btnEmail = document.getElementById('btn-email-notify');

            if (btnWhatsapp && btnEmail) {
                btnWhatsapp.onclick = () => sendWhatsappNotification(task);
                btnEmail.onclick = () => sendEmailNotification(task);
            }

            const assignmentControl = document.getElementById('task-assignment-control');
            const assignmentSelect = document.getElementById('task-assigned-member');
            taskTeamMembers = [];
            assignmentSelect.innerHTML = '<option value="">Sem atribuição</option>';
            assignmentControl.classList.toggle('hidden', userRole !== 'admin');

            if (userRole === 'admin') {
                const { data, error } = await supabaseClient
                    .from('team_members')
                    .select('id, name, email, role, track_hours, require_photos')
                    .eq('role', 'cleaner')
                    .order('name');
                if (error) {
                    alert('Erro ao carregar membros para atribuir a limpeza: ' + error.message);
                    return;
                }
                taskTeamMembers = data || [];
                taskTeamMembers.forEach(member => {
                    assignmentSelect.add(new Option(member.name || member.email || 'Membro da equipa', member.id));
                });
                assignmentSelect.value = task.assigned_team_member_id || '';
            }

            document.getElementById('task-notes').value = task.cleaner_notes || '';
            const getAssignedPreferences = () => {
                const assignedId = userRole === 'admin'
                    ? assignmentSelect.value
                    : task.assigned_team_member_id;
                const assignedMember = taskTeamMembers.find(member => String(member.id) === String(assignedId));
                if (assignedMember) {
                    return {
                        track_hours: assignedMember.track_hours === true,
                        require_photos: assignedMember.require_photos === true
                    };
                }
                if (currentTeamMemberId && String(currentTeamMemberId) === String(assignedId)) {
                    return currentTeamMemberPreferences;
                }
                return { track_hours: false, require_photos: false };
            };

            document.getElementById('modal-content').innerHTML = `
                <div class="space-y-4">
                    <div class="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                        <p><strong>📅 Data:</strong> ${task.scheduled_date}</p>
                        <p><strong>📍 Morada:</strong> ${task.properties?.address || '---'}</p>
                        <p class="text-emerald-700"><strong>🔑 Keybox:</strong> ${task.properties?.access_code || 'N/A'}</p>
                        <p class="text-indigo-700"><strong>💶 Taxa Base:</strong> ${task.properties?.hourly_rate || 10.00}€/h</p>
                    </div>

                    <div class="bg-amber-50/60 p-3 rounded-xl border border-amber-100 text-amber-900">
                        <strong>📋 Instruções Específicas:</strong>
                        <p class="mt-1">${task.properties?.instructions || 'Nenhuma instrução definida.'}</p>
                    </div>

                    <div class="space-y-2 pt-2 border-t border-slate-100">
                        <label class="block font-bold text-slate-700">Estado da Tarefa</label>
                        <select id="modal-status-${task.id}" class="w-full border border-slate-200 p-2.5 rounded-xl font-bold bg-white text-xs">
                            <option value="pending" ${task.status === 'pending' ? 'selected' : ''}>⏳ Pendente</option>
                            <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>🔄 Em Andamento</option>
                            <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>🟢 Concluída</option>
                        </select>
                    </div>

                    <div id="task-permission-modules"></div>
                    <button onclick="saveTaskModalDetails('${task.id}')" class="w-full gradient-bg hover:opacity-95 text-white font-bold p-3 rounded-xl text-xs transition shadow-md mt-3">Guardar Alterações</button>
                </div>
            `;

            const renderPermissionModules = () => {
                document.getElementById('task-permission-modules').innerHTML =
                    renderTaskPermissionModules(task, getAssignedPreferences());
            };
            renderPermissionModules();
            if (userRole === 'admin') {
                assignmentSelect.onchange = renderPermissionModules;
            }
            document.getElementById('task-modal').classList.remove('hidden');
        }

        async function uploadTaskPhoto(event, taskId, photoField) {
            const file = event.target.files[0];
            if (!file) return;

            const fileExt = file.name.split('.').pop();
            const fileName = `${taskId}_${photoField}_${Date.now()}.${fileExt}`;

            alert('A carregar imagem...');

            const { data, error } = await supabaseClient.storage.from('cleaning-photos').upload(fileName, file);

            if (error) {
                alert('Erro ao carregar fotografia: ' + error.message + '\nCertifique-se de que criou o bucket "cleaning-photos" no Supabase Storage.');
                return;
            }

            const { data: publicUrlData } = supabaseClient.storage.from('cleaning-photos').getPublicUrl(fileName);
            const photoUrl = publicUrlData.publicUrl;

            await supabaseClient.from('cleaning_tasks').update({ [photoField]: photoUrl }).eq('id', taskId);

            alert('Fotografia guardada com sucesso!');
            await loadData();
            closeTaskModal();
        }

        function sendWhatsappNotification(task) {
            const propName = task.properties?.name || 'Alojamento';
            const address = task.properties?.address || 'Ver app';
            const access = task.properties?.access_code || 'Ver app';
            const notes = task.cleaner_notes || task.properties?.instructions || 'Sem notas adicionais';

            const message = `🧹 *Host a Cleaner - Tarefa de Limpeza*\n\n` +
                            `🏠 *Imóvel:* ${propName}\n` +
                            `📅 *Data:* ${task.scheduled_date}\n` +
                            `📍 *Morada:* ${address}\n` +
                            `🔑 *Keybox:* ${access}\n\n` +
                            `📋 *Instruções:* ${notes}\n\n` +
                            `Por favor confirma a receção desta mensagem!`;

            const encodedMsg = encodeURIComponent(message);
            window.open(`https://wa.me/?text=${encodedMsg}`, '_blank');
        }

        function sendEmailNotification(task) {
            const propName = task.properties?.name || 'Alojamento';
            const subject = encodeURIComponent(`🧹 Lembrete de Limpeza: ${propName} (${task.scheduled_date})`);
            
            const body = encodeURIComponent(
                `Olá!\n\nAqui estão os detalhes para a limpeza agendada:\n\n` +
                `🏠 Imóvel: ${propName}\n` +
                `📅 Data: ${task.scheduled_date}\n` +
                `📍 Morada: ${task.properties?.address || 'Sem morada'}\n` +
                `🔑 Keybox: ${task.properties?.access_code || 'N/A'}\n\n` +
                `📋 Instruções: ${task.cleaner_notes || task.properties?.instructions || 'Nenhuma'}\n\n` +
                `Bons trabalhos,\nHost a Cleaner`
            );

            window.location.href = `mailto:?subject=${subject}&body=${body}`;
        }

        function handleStripeCheckout() {
            const stripePaymentLink = 'https://buy.stripe.com/'; 
            
            if (stripePaymentLink === 'https://buy.stripe.com/') {
                alert('Ambiente de Demonstração SaaS: Aqui o utilizador será redirecionado para a página de pagamento seguro do Stripe para ativar a subscrição.');
            } else {
                window.open(stripePaymentLink, '_blank');
            }
        }

        async function deleteTask(taskId) {
            if (!confirm('Tem a certeza que deseja apagar esta limpeza?')) return;
            await supabaseClient.from('cleaning_tasks').delete().eq('id', taskId);
            alert('Limpeza apagada!');
            closeTaskModal();
            closeDayTasksModal();
            await loadData();
        }

        function closeTaskModal() {
            document.getElementById('task-modal').classList.add('hidden');
        }

        async function saveTaskModalDetails(taskId) {
            const status = document.getElementById(`modal-status-${taskId}`).value;
            const cleaner_notes = document.getElementById('task-notes').value;
            const hoursInput = document.getElementById(`modal-hours-${taskId}`);
            const hours_spent = hoursInput ? hoursInput.value : null;

            const taskUpdates = {
                status,
                cleaner_notes
            };
            if (userRole === 'admin') {
                taskUpdates.assigned_team_member_id =
                    document.getElementById('task-assigned-member').value || null;
            }
            if (hoursInput) taskUpdates.hours_spent = hours_spent ? parseFloat(hours_spent) : 0;
            const { error } = await supabaseClient.from('cleaning_tasks').update(taskUpdates).eq('id', taskId);
            if (error) {
                alert('Erro ao guardar as alterações: ' + error.message);
                return;
            }

            alert('Atualizado com sucesso!');
            closeTaskModal();
            closeDayTasksModal();
            await loadData();
        }

        async function fetchHistoryAdmin() {
            const historyListEl = document.getElementById('history-tasks-list');
            const totalHoursBadge = document.getElementById('total-hours-badge');
            const totalAmountBadge = document.getElementById('total-amount-badge');
            if (!historyListEl || !currentUser) return;

            const completedTasks = allTasksCache.filter(t => t.status === 'completed');

            if (completedTasks.length === 0) {
                historyListEl.innerHTML = `<p class="text-slate-400 text-xs">Sem limpezas concluídas.</p>`;
                if (totalHoursBadge) totalHoursBadge.innerText = "Total: 0h";
                if (totalAmountBadge) totalAmountBadge.innerText = "Total: 0.00€";
                return;
            }

            let totalHours = 0;
            let totalAmount = 0;

            historyListEl.innerHTML = completedTasks.map(task => {
                const hours = Number(task.hours_spent || 0);
                const rate = Number(task.properties?.hourly_rate || 10);
                const taskTotal = hours * rate;

                totalHours += hours;
                totalAmount += taskTotal;

                const isPaid = task.payment_status === 'paid';

                return `
                    <div class="border ${isPaid ? 'border-emerald-200 bg-emerald-50/40' : 'border-amber-200 bg-amber-50/40'} p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs">
                        <div class="space-y-1">
                            <div class="flex items-center gap-2">
                                <strong class="text-slate-900">${task.properties?.name || 'Alojamento'}</strong>
                                <span class="text-slate-500">📅 ${task.scheduled_date}</span>
                            </div>
                            ${task.cleaner_notes ? `<p class="text-slate-600">💬 "${task.cleaner_notes}"</p>` : ''}
                        </div>
                        <div class="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 shrink-0">
                            <span class="font-bold text-slate-800">${hours}h × ${rate.toFixed(2)}€ = ${taskTotal.toFixed(2)}€</span>
                            
                            ${userRole === 'admin' ? `
                                <button onclick="togglePaymentStatus('${task.id}', '${task.payment_status || 'pending'}')" class="px-3 py-1.5 rounded-xl font-bold transition ${isPaid ? 'bg-emerald-600 text-white shadow-sm' : 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm'}">
                                    ${isPaid ? '🟢 Pago' : '⏳ Pendente'}
                                </button>
                            ` : `
                                <span class="px-3 py-1.5 rounded-xl font-bold ${isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
                                    ${isPaid ? '🟢 Pago' : '⏳ Pendente'}
                                </span>
                            `}
                        </div>
                    </div>
                `;
            }).join('');

            if (totalHoursBadge) totalHoursBadge.innerText = `Total: ${totalHours.toFixed(1)}h`;
            if (totalAmountBadge) totalAmountBadge.innerText = `Total: ${totalAmount.toFixed(2)}€`;
        }

        async function togglePaymentStatus(taskId, currentStatus) {
            if (userRole !== 'admin') return;
            const newStatus = currentStatus === 'paid' ? 'pending' : 'paid';
            await supabaseClient.from('cleaning_tasks').update({ payment_status: newStatus }).eq('id', taskId);
            await loadData();
            fetchHistoryAdmin();
        }

        function setCalendarMode(mode) {
            calendarMode = mode;
            document.getElementById('btn-mode-week').className = mode === 'week' ? "px-3 py-1.5 rounded-lg bg-white text-indigo-600 shadow-sm font-bold" : "px-3 py-1.5 rounded-lg text-slate-500 font-bold";
            document.getElementById('btn-mode-month').className = mode === 'month' ? "px-3 py-1.5 rounded-lg bg-white text-indigo-600 shadow-sm font-bold" : "px-3 py-1.5 rounded-lg text-slate-500 font-bold";
            renderOverviewCalendar();
        }

        function changeCalendarPeriod(direction) {
            if (calendarMode === 'week') {
                currentCalendarDate.setDate(currentCalendarDate.getDate() + (direction * 7));
            } else {
                currentCalendarDate.setMonth(currentCalendarDate.getMonth() + direction);
            }
            renderOverviewCalendar();
        }

        function renderOverviewCalendar() {
            const grid = document.getElementById('calendar-grid');
            const titleEl = document.getElementById('calendar-period-title');
            if (!grid || !titleEl) return;

            grid.innerHTML = '';
            const year = currentCalendarDate.getFullYear();
            const month = currentCalendarDate.getMonth();
            const locale = currentLang === 'pt' ? 'pt-PT' : 'en-US';

            // Cabeçalho único e limpo para os dias da semana
            const daysHeaderHTML = `
                <div class="grid grid-cols-7 gap-1.5 sm:gap-2 col-span-7 font-bold text-center text-[11px] sm:text-xs text-slate-400 pb-2 border-b border-slate-100">
                    <div>${currentLang === 'pt' ? 'Dom' : 'Sun'}</div>
                    <div>${currentLang === 'pt' ? 'Seg' : 'Mon'}</div>
                    <div>${currentLang === 'pt' ? 'Ter' : 'Tue'}</div>
                    <div>${currentLang === 'pt' ? 'Qua' : 'Wed'}</div>
                    <div>${currentLang === 'pt' ? 'Qui' : 'Thu'}</div>
                    <div>${currentLang === 'pt' ? 'Sex' : 'Fri'}</div>
                    <div>${currentLang === 'pt' ? 'Sáb' : 'Sat'}</div>
                </div>
            `;

            if (calendarMode === 'month') {
                titleEl.innerText = currentCalendarDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
                
                const firstDayIndex = new Date(year, month, 1).getDay();
                const totalDays = new Date(year, month + 1, 0).getDate();

                grid.innerHTML = daysHeaderHTML;

                for (let i = 0; i < firstDayIndex; i++) {
                    grid.innerHTML += `<div class="border border-slate-100 bg-slate-50/30 rounded-xl min-h-[70px] md:min-h-[100px]"></div>`;
                }

                for (let day = 1; day <= totalDays; day++) {
                    const formattedDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const dayTasks = allTasksCache.filter(t => t.scheduled_date === formattedDate);

                    grid.innerHTML += `
                        <div onclick="openDayTasksModal('${formattedDate}')" class="border border-slate-200/80 bg-white p-1.5 rounded-xl min-h-[75px] md:min-h-[100px] flex flex-col justify-start hover:border-indigo-400 hover:shadow-sm cursor-pointer transition space-y-1">
                            <span class="text-xs font-bold text-slate-700 block text-right pr-0.5">${day}</span>
                            <div class="space-y-1 overflow-y-auto max-h-[50px] md:max-h-[70px]">
                                ${dayTasks.map(t => `
                                    <div class="text-[9px] bg-indigo-50 text-indigo-700 p-1 rounded-md font-bold truncate border border-indigo-100/60">
                                        🧹 ${t.properties?.name || 'Limpeza'}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `;
                }
            } else {
                const startOfWeek = new Date(currentCalendarDate);
                startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
                
                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(endOfWeek.getDate() + 6);

                titleEl.innerText = `${startOfWeek.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} - ${endOfWeek.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}`;

                grid.innerHTML = daysHeaderHTML;

                for (let i = 0; i < 7; i++) {
                    const loopDate = new Date(startOfWeek);
                    loopDate.setDate(loopDate.getDate() + i);
                    const formattedDate = loopDate.toISOString().split('T')[0];
                    const dayTasks = allTasksCache.filter(t => t.scheduled_date === formattedDate);

                    grid.innerHTML += `
                        <div onclick="openDayTasksModal('${formattedDate}')" class="border border-slate-200/80 bg-white p-2 rounded-2xl min-h-[180px] md:min-h-[220px] flex flex-col justify-start hover:border-indigo-400 hover:shadow-sm cursor-pointer transition space-y-1.5">
                            <div class="text-center border-b border-slate-100 pb-1">
                                <span class="text-xs font-extrabold text-slate-800">${loopDate.getDate()}</span>
                            </div>
                            <div class="space-y-1 overflow-y-auto max-h-[140px] md:max-h-[170px] pr-0.5">
                                ${dayTasks.map(t => `
                                    <div class="text-[10px] bg-indigo-50 text-indigo-700 p-1.5 rounded-lg font-bold truncate border border-indigo-100/80 shadow-2xs">
                                        🧹 ${t.properties?.name || 'Limpeza'}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `;
                }
            }
        }

        async function forceSyncICalNow() {
            const btn = document.getElementById('btn-force-sync-sidebar');
            const syncIcon = document.getElementById('sync-icon');
            btn.disabled = true;
            syncIcon.classList.add('animate-spin');

            try {
                const response = await fetch(`${SUPABASE_URL}/functions/v1/sync-ical`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${SUPABASE_KEY}`
                    }
                });

                if (!response.ok) throw new Error(`Erro no servidor: ${response.status}`);

                const data = await response.json();
                alert(`Sincronização concluída com sucesso! ${data?.totalCreated || 0} nova(s) limpeza(s) adicionada(s).`);
                await loadData();

            } catch (err) {
                alert('Erro na sincronização: ' + err.message);
            } finally {
                btn.disabled = false;
                syncIcon.classList.remove('animate-spin');
            }
        }

        async function handlePropertySubmit(e) {
            e.preventDefault();
            if (!currentUser || userRole !== 'admin') return;

            const name = document.getElementById('prop-name').value;
            const address = document.getElementById('prop-address').value;
            const access_code = document.getElementById('prop-access').value;
            const ical_url = document.getElementById('prop-ical').value;
            const instructions = document.getElementById('prop-instructions').value;
            const hourly_rate = parseFloat(document.getElementById('prop-rate').value) || 10.00;

            if (editingPropertyId) {
                const { error } = await supabaseClient.from('properties').update({ name, address, access_code, ical_url, instructions, hourly_rate }).eq('id', editingPropertyId);
                if (error) alert('Erro ao atualizar: ' + error.message);
                else { alert('Alojamento atualizado!'); resetPropertyForm(); await loadData(); switchTab('sub-properties-list'); }
            } else {
                const { error } = await supabaseClient.from('properties').insert([{ name, address, access_code, ical_url, instructions, hourly_rate, user_id: currentUser.id }]);
                if (error) alert('Erro ao registar: ' + error.message);
                else { document.getElementById('property-form').reset(); await loadData(); alert('Alojamento guardado!'); switchTab('sub-properties-list'); }
            }
        }

        document.addEventListener('DOMContentLoaded', () => {
            const searchParams = new URLSearchParams(window.location.search);
            const hash = window.location.hash.toLowerCase();
            const inviteParam = searchParams.get('invite');
            pendingTeamInviteToken = inviteParam && inviteParam.toLowerCase() !== 'true' ? inviteParam : null;
            registrationRole = searchParams.get('role') || 'cleaner';
            registrationRequested = inviteParam?.toLowerCase() === 'true' || hash === '#register';

            initApp().finally(() => {
                window.clearTimeout(window.__appStartupFallback);
                document.documentElement.classList.remove('app-loading');
            });
        });

const passwordSetupContainer = document.getElementById('set-password-container');
        const mainAppContainer = document.getElementById('main-app-container');

        function showPasswordSetup() {
            mainAppContainer.classList.add('hidden');
            passwordSetupContainer.classList.remove('hidden');
        }

        supabaseClient.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') {
                showPasswordSetup();
            }
        });

        const authHashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        if (authHashParams.get('type') === 'invite' || authHashParams.get('type') === 'recovery') {
            showPasswordSetup();
        }

        document.getElementById('btn-save-password').addEventListener('click', async () => {
            const passwordInput = document.getElementById('input-new-password');
            const saveButton = document.getElementById('btn-save-password');
            const newPassword = passwordInput.value;

            if (!passwordInput.reportValidity()) return;

            saveButton.disabled = true;
            try {
                const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
                if (error) throw error;

                const cleanUrl = new URL(window.location.href);
                cleanUrl.hash = '';
                window.history.replaceState({}, document.title, cleanUrl.toString());
                window.location.reload();
            } catch (error) {
                alert('Erro ao guardar a palavra-passe: ' + error.message);
                saveButton.disabled = false;
            }
        });
