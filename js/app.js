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
        let currentTeamManagerId = null;
        let pendingTeamInviteToken = null;
        let registrationRole = 'cleaner';
        let registrationRequested = false;
        let propertyCleaners = [];
        let currentLang = localStorage.getItem('host_cleaner_lang') || 'pt';
        
        function getLocalDateString(date = new Date()) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        let selectedDate = getLocalDateString();
        let selectedPropertyFilter = 'all';
        let editingPropertyId = null;
        
        let calendarMode = 'day';
        let currentCalendarDate = new Date();
        let allTasksCache = [];
        let agendaTasksCache = [];
        let agendaRequestId = 0;
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
                nav_cat_calendar: "📅 Agenda",
                nav_agenda: "Agenda",
                nav_daily_tasks: "Tarefas Diárias (Lista)",
                nav_overview_cal: "Vista Semanal / Mensal",
                nav_settings: "Definições",
                nav_add_property: "Adicionar Alojamento",
                nav_manage_properties: "Gestão de Alojamento",
                nav_team_directory: "Equipa (consulta)",
                nav_time_entries: "Registo de Horas",
                team_read_only_title: "Equipa",
                time_entries_submitted: "Registos submetidos",
                nav_profile: "Perfil",
                nav_add_team: "Gestão de Equipa",
                role_locked: "Acesso reservado ao administrador",
                role_read_only: "Modo de consulta",
                time_entries_title: "Registo de Horas Trabalhadas",
                time_entry_date: "Data",
                time_entry_property: "Alojamento",
                time_entry_task: "Tarefa / descrição",
                time_entry_no_property: "Sem alojamento associado",
                time_entry_hours: "Horas trabalhadas",
                time_entry_submit: "Registar horas",
                time_entry_saved: "Horas registadas com sucesso.",
                time_entry_error: "Não foi possível registar as horas",
                time_entry_validation: "Indique a data, a tarefa e um total de horas entre 0 e 24.",
                time_entry_member_error: "Esta conta não está associada a um membro de equipa ativo.",
                time_entries_loading: "A carregar registos...",
                time_entries_empty: "Ainda não existem horas registadas.",
                time_entries_team_member: "Membro",
                time_entry_description_placeholder: "Descreva a tarefa realizada",
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
                btn_mode_day: "Diária",
                agenda_total: "Limpezas hoje",
                agenda_completed: "Concluídas hoje",
                agenda_pending: "Pendentes hoje",
                agenda_no_tasks: "Sem limpezas agendadas para esta data.",
                agenda_loading: "A carregar agenda...",
                agenda_load_error: "Erro ao carregar a agenda",
                agenda_today: "Hoje",
                title_registered_properties: "Alojamentos Registados",
                nav_reports: "Relatórios & Desempenho",
                reports_by_property: "Desempenho por imóvel",
                reports_add_entry: "Registar entrada ou saída",
                reports_property: "Imóvel",
                reports_type: "Tipo de movimento",
                reports_income: "Ganho",
                reports_expense: "Gasto",
                reports_amount: "Valor (€)",
                reports_date: "Data",
                reports_description: "Descrição",
                reports_save: "Guardar movimento",
                reports_loading: "A carregar métricas...",
                reports_load_error: "Não foi possível carregar os relatórios",
                reports_empty: "Ainda não existem imóveis ou movimentos financeiros.",
                reports_income_total: "Ganhos totais",
                reports_expense_total: "Gastos totais",
                reports_net_total: "Lucro líquido",
                reports_most_requested: "Imóvel mais procurado",
                reports_cleanings_count: "limpezas registadas",
                reports_no_cleanings: "Sem limpezas registadas",
                reports_entry_success: "Movimento registado com sucesso.",
                reports_entry_error: "Não foi possível registar o movimento",
                reports_select_property: "Selecione um imóvel",
                reports_invalid_entry: "Indique um valor superior a zero e uma descrição.",
                photo_upload: "Tirar ou anexar foto",
                photo_gallery: "Fotografias da tarefa",
                photo_uploading: "A carregar fotografia...",
                photo_upload_success: "Fotografia anexada com sucesso.",
                photo_upload_error: "Não foi possível anexar a fotografia",
                photo_upload_type_error: "Selecione um ficheiro de imagem até 10 MB.",
                photo_empty: "Ainda não há fotografias anexadas.",
                btn_add_property_new: "➕ Adicionar Nova Propriedade",
                label_assigned_cleaner: "Cleaner Atribuído",
                option_no_cleaner: "Sem atribuição",
                loading_cleaners: "A carregar cleaners...",
                loading_properties: "A carregar alojamentos...",
                error_properties: "Erro ao carregar alojamentos",
                retry: "Tentar novamente",
                empty_properties: "Ainda não tem propriedades registadas.",
                property_cleaner_label: "Cleaner:",
                property_access_label: "🔑 Acesso:",
                property_team_load_error: "Não foi possível carregar a equipa",
                property_form_access_error: "Inicie sessão como gestor para guardar propriedades.",
                property_form_validation_error: "Preencha o nome, a morada e um valor por hora válido.",
                property_update_success: "Propriedade atualizada com sucesso.",
                property_add_success: "Propriedade adicionada com sucesso.",
                property_save_error: "Não foi possível guardar a propriedade",
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
                nav_cat_calendar: "📅 Agenda",
                nav_agenda: "Agenda",
                nav_daily_tasks: "Daily Tasks (List)",
                nav_overview_cal: "Weekly / Monthly View",
                nav_settings: "Settings",
                nav_add_property: "Add Property",
                nav_manage_properties: "Property Management",
                nav_team_directory: "Team (read-only)",
                nav_time_entries: "Work Hours",
                team_read_only_title: "Team",
                time_entries_submitted: "Submitted entries",
                nav_profile: "Profile",
                nav_add_team: "Team Management",
                role_locked: "Administrator access only",
                role_read_only: "Read-only",
                time_entries_title: "Work Hours Log",
                time_entry_date: "Date",
                time_entry_property: "Property",
                time_entry_task: "Task / description",
                time_entry_no_property: "No property",
                time_entry_hours: "Hours worked",
                time_entry_submit: "Log hours",
                time_entry_saved: "Hours logged successfully.",
                time_entry_error: "Could not log hours",
                time_entry_validation: "Enter the date, task, and hours between 0 and 24.",
                time_entry_member_error: "This account is not linked to an active team member.",
                time_entries_loading: "Loading entries...",
                time_entries_empty: "No work hours have been logged yet.",
                time_entries_team_member: "Team member",
                time_entry_description_placeholder: "Describe the work completed",
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
                btn_mode_day: "Daily",
                agenda_total: "Cleanings today",
                agenda_completed: "Completed today",
                agenda_pending: "Pending today",
                agenda_no_tasks: "No cleanings scheduled for this date.",
                agenda_loading: "Loading agenda...",
                agenda_load_error: "Error loading agenda",
                agenda_today: "Today",
                title_registered_properties: "Registered Properties",
                nav_reports: "Reports & Performance",
                reports_by_property: "Performance by property",
                reports_add_entry: "Record income or expense",
                reports_property: "Property",
                reports_type: "Entry type",
                reports_income: "Income",
                reports_expense: "Expense",
                reports_amount: "Amount (€)",
                reports_date: "Date",
                reports_description: "Description",
                reports_save: "Save entry",
                reports_loading: "Loading metrics...",
                reports_load_error: "Could not load reports",
                reports_empty: "No properties or financial entries yet.",
                reports_income_total: "Total income",
                reports_expense_total: "Total expenses",
                reports_net_total: "Net profit",
                reports_most_requested: "Most requested property",
                reports_cleanings_count: "recorded cleanings",
                reports_no_cleanings: "No cleanings recorded",
                reports_entry_success: "Entry recorded successfully.",
                reports_entry_error: "Could not record the entry",
                reports_select_property: "Select a property",
                reports_invalid_entry: "Enter an amount greater than zero and a description.",
                photo_upload: "Take or attach photo",
                photo_gallery: "Task photos",
                photo_uploading: "Uploading photo...",
                photo_upload_success: "Photo attached successfully.",
                photo_upload_error: "Could not attach the photo",
                photo_upload_type_error: "Select an image file up to 10 MB.",
                photo_empty: "No photos attached yet.",
                btn_add_property_new: "➕ Add New Property",
                label_assigned_cleaner: "Assigned Cleaner",
                option_no_cleaner: "Unassigned",
                loading_cleaners: "Loading cleaners...",
                loading_properties: "Loading properties...",
                error_properties: "Error loading properties",
                retry: "Try again",
                empty_properties: "No properties registered yet.",
                property_cleaner_label: "Cleaner:",
                property_access_label: "🔑 Access:",
                property_team_load_error: "Could not load the team",
                property_form_access_error: "Sign in as a manager to save properties.",
                property_form_validation_error: "Enter a name, address, and valid hourly rate.",
                property_update_success: "Property updated successfully.",
                property_add_success: "Property added successfully.",
                property_save_error: "Could not save the property",
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
            document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
                const key = el.getAttribute('data-i18n-placeholder');
                if (i18n[lang] && i18n[lang][key]) el.placeholder = i18n[lang][key];
            });

            // Re-renderiza o calendário para atualizar os dias da semana
            if (!document.getElementById('view-sub-agenda').classList.contains('hidden')) renderAgendaView();
            if (!document.getElementById('view-sub-reports').classList.contains('hidden')) {
                carregarRelatorios();
            }
            if (!document.getElementById('view-sub-time-entries').classList.contains('hidden')) {
                carregarRegistosHoras();
            }
        }

        async function initApp() {
            changeLanguage(currentLang);
            document.getElementById('calendar-date-picker').value = selectedDate;
            document.getElementById('financial-date').value = new Date().toISOString().slice(0, 10);
            document.getElementById('time-entry-date').value = getLocalDateString();
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
            const [{ data: member, error: memberError }, { data: profile, error: profileError }] = await Promise.all([
                supabaseClient
                    .from('team_members')
                    .select('id, role, track_hours, require_photos, manager_id')
                    .eq('auth_user_id', currentUser.id)
                    .maybeSingle(),
                supabaseClient
                    .from('profiles')
                    .select('role')
                    .eq('id', currentUser.id)
                    .maybeSingle()
            ]);
            if (memberError) {
                console.error('Erro ao carregar o perfil do membro da equipa:', memberError);
                throw memberError;
            }
            if (profileError) {
                console.warn('Não foi possível ler o papel em profiles; será usado o papel dos metadados.', profileError);
            }

            currentTeamManagerId = null;
            currentTeamMemberId = null;
            if (member?.role === 'cleaner') {
                userRole = 'cleaner';
                currentTeamMemberId = member.id;
                currentTeamManagerId = member.manager_id;
                currentTeamMemberPreferences = {
                    track_hours: member.track_hours === true,
                    require_photos: member.require_photos === true
                };
                return;
            }

            const validRoles = ['admin', 'cleaner'];
            const profileRole = validRoles.includes(profile?.role) ? profile.role : null;
            const appMetadataRole = currentUser.app_metadata?.role;
            const userMetadataRole = currentUser.user_metadata?.role === 'cleaner' ? 'cleaner' : null;
            const metadataRole = validRoles.includes(appMetadataRole) ? appMetadataRole : userMetadataRole;
            const resolvedRole = profileRole || metadataRole;
            if (resolvedRole) {
                userRole = resolvedRole;
            } else {
                const { count, error: propertyError } = await supabaseClient
                    .from('properties')
                    .select('id', { count: 'exact', head: true })
                    .eq('user_id', currentUser.id);
                if (propertyError) {
                    console.warn('Não foi possível determinar o papel pela propriedade dos alojamentos.', propertyError);
                }
                userRole = count > 0 ? 'admin' : 'cleaner';
            }
            currentTeamMemberPreferences = { track_hours: false, require_photos: false };
        }

        function applyRolePermissionsUI() {
            const adminElements = document.querySelectorAll('.admin-only');
            const cleanerElements = document.querySelectorAll('.cleaner-only');
            const lockedRoutes = document.querySelectorAll('[data-admin-route]');
            const isCleaner = userRole === 'cleaner';
            adminElements.forEach(el => el.classList.toggle('hidden', isCleaner));
            cleanerElements.forEach(el => el.classList.toggle('hidden', !isCleaner));
            lockedRoutes.forEach(button => {
                button.disabled = isCleaner;
                button.setAttribute('aria-disabled', String(isCleaner));
                button.title = isCleaner ? i18n[currentLang].role_locked : '';
                button.querySelector('.role-lock-icon')?.classList.toggle('hidden', !isCleaner);
                button.classList.toggle('cursor-not-allowed', isCleaner);
                button.classList.toggle('opacity-70', isCleaner);
            });
            document.getElementById('team-admin-panel')?.classList.toggle('hidden', isCleaner);
            document.getElementById('team-readonly-notice')?.classList.toggle('hidden', !isCleaner);
            document.getElementById('time-entry-form')?.classList.toggle('hidden', !isCleaner);
            if (isCleaner) {
                document.getElementById('sidebar-role-subtitle').innerText = "Equipa de Limpeza";
                document.getElementById('profile-role-badge').innerText = "Limpeza";
            } else {
                document.getElementById('sidebar-role-subtitle').innerText = "Admin Hub";
                document.getElementById('profile-role-badge').innerText = "Admin";
            }
        }

        function requireAdminAction() {
            if (userRole === 'admin' && currentUser) return true;
            alert(i18n[currentLang].role_locked);
            return false;
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
                        role: role === 'co-host' ? 'co-host' : 'cleaner'
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
            
            const previousTab = localStorage.getItem('host_cleaner_active_tab');
            const savedTab = ['sub-calendar-daily', 'sub-calendar-overview'].includes(previousTab) ? 'sub-agenda' : previousTab || 'sub-agenda';
            const restrictedTabs = ['sub-properties-add', 'sub-reports'];
            if (userRole === 'cleaner' && restrictedTabs.includes(savedTab)) {
                switchTab('sub-agenda');
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
            
            if (userRole === 'cleaner' && ['sub-properties-add', 'sub-reports'].includes(subtabId)) {
                alert(i18n[currentLang].role_locked);
                return;
            }

            if (['sub-properties-list', 'sub-properties-add', 'sub-team-management'].includes(subtabId)) {
                toggleSettingsMenu(true);
            }

            localStorage.setItem('host_cleaner_active_tab', subtabId);

            const tabs = ['sub-agenda', 'sub-properties-list', 'sub-properties-add', 'sub-history', 'sub-reports', 'sub-team-management', 'sub-time-entries'];
            tabs.forEach(t => {
                const el = document.getElementById(`view-${t}`);
                if (el) el.classList.toggle('hidden', t !== subtabId);
                const btn = document.getElementById(`btn-${t}`);
                if (btn) {
                    if (t === subtabId && !(userRole === 'cleaner' && t === 'sub-team-management')) {
                        btn.className = "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white shadow-lg transition whitespace-nowrap";
                    } else {
                        btn.className = "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition whitespace-nowrap";
                    }
                }
            });
            const teamDirectoryButton = document.getElementById('btn-sub-team-directory');
            if (teamDirectoryButton) {
                const directoryStateClass = userRole !== 'cleaner'
                    ? 'hidden text-slate-300'
                    : subtabId === 'sub-team-management'
                        ? 'bg-indigo-600 text-white shadow-lg'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white';
                teamDirectoryButton.className = `cleaner-only ${directoryStateClass} w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap`;
            }

            if (subtabId === 'sub-agenda') fetchAgendaTasks();
            if (subtabId === 'sub-properties-list') carregarPropriedades();
            if (subtabId === 'sub-properties-add' && !editingPropertyId) carregarCleaners();
            if (subtabId === 'sub-history') fetchHistoryAdmin();
            if (subtabId === 'sub-reports') carregarRelatorios();
            if (subtabId === 'sub-team-management') fetchTeamMembers();
            if (subtabId === 'sub-time-entries') carregarRegistosHoras();
        }

        async function loadData() {
            await fetchPropertiesForSelect();
            await fetchTeamMembers();
            if (userRole === 'admin') await carregarCleaners();
            await carregarPropriedades();
            await fetchAllTasksCache();
            await fetchAgendaTasks();
            if (!document.getElementById('view-sub-reports').classList.contains('hidden')) {
                carregarRelatorios();
            }
        }

        async function fetchAllTasksCache() {
            let { data } = await supabaseClient.from('cleaning_tasks').select(`*, properties!inner(name, address, access_code, instructions, hourly_rate, user_id)`);
            allTasksCache = data || [];
        }

        async function fetchPropertiesForSelect() {
            const filterSelect = document.getElementById('filter-property-select');
            const { data, error } = await supabaseClient.from('properties').select('*');
            if (error) {
                console.error('Erro ao carregar alojamentos para o filtro:', error);
                allPropertiesCache = [];
                if (filterSelect) filterSelect.replaceChildren(new Option('Erro ao carregar alojamentos', ''));
                return;
            }
            allPropertiesCache = data || [];

            if (filterSelect) {
                filterSelect.replaceChildren(
                    new Option(i18n[currentLang].opt_all_properties, 'all'),
                    ...allPropertiesCache.map(property => new Option(property.name, property.id))
                );
                if (!allPropertiesCache.some(property => String(property.id) === String(selectedPropertyFilter))) {
                    selectedPropertyFilter = 'all';
                }
                filterSelect.value = selectedPropertyFilter;
            }
        }

        function escapePropertyHTML(value) {
            return String(value ?? '').replace(/[&<>"']/g, character => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            })[character]);
        }

        function showPropertyMessage(elementId, message, type) {
            const element = document.getElementById(elementId);
            if (!element) return;
            element.innerText = message;
            element.classList.remove('hidden', 'text-rose-600', 'text-emerald-700');
            element.classList.add(type === 'error' ? 'text-rose-600' : 'text-emerald-700');
            element.setAttribute('role', type === 'error' ? 'alert' : 'status');
        }

        function hidePropertyMessage(elementId) {
            document.getElementById(elementId)?.classList.add('hidden');
        }

        async function carregarCleaners() {
            const select = document.getElementById('prop-assigned-cleaner');
            const status = document.getElementById('property-cleaner-status');
            if (!select) return;
            select.disabled = true;
            select.innerHTML = `<option value="">${i18n[currentLang].loading_cleaners}</option>`;
            status.classList.add('hidden');

            const { data, error } = await supabaseClient
                .from('team_members')
                .select('id, name, email')
                .eq('role', 'cleaner')
                .order('name');

            if (error) {
                console.error('Erro ao carregar cleaners para as propriedades:', error);
                propertyCleaners = [];
                select.innerHTML = `<option value="">${i18n[currentLang].option_no_cleaner}</option>`;
                select.disabled = false;
                showPropertyMessage('property-cleaner-status', `${i18n[currentLang].property_team_load_error}: ${error.message}`, 'error');
                return;
            }

            propertyCleaners = data || [];
            select.replaceChildren(new Option(i18n[currentLang].option_no_cleaner, ''));
            propertyCleaners.forEach(cleaner => {
                select.add(new Option(cleaner.name || cleaner.email || 'Cleaner', cleaner.id));
            });
            select.disabled = false;
        }

        async function carregarPropriedades() {
            const gridEl = document.getElementById('properties-grid');
            if (!gridEl) return;

            gridEl.innerHTML = `<p class="text-slate-400 text-xs col-span-full">${i18n[currentLang].loading_properties}</p>`;
            const { data, error } = await supabaseClient.from('properties').select('*').order('created_at', { ascending: false });

            if (error) {
                console.error('Erro ao carregar alojamentos:', error);
                gridEl.innerHTML = `
                    <div class="col-span-full rounded-2xl border border-rose-200 bg-rose-50 p-4" role="alert">
                        <p class="text-rose-700 text-xs">${i18n[currentLang].error_properties}: ${escapePropertyHTML(error.message)}</p>
                        <button type="button" onclick="carregarPropriedades()" class="mt-2 text-xs font-bold text-rose-700 underline">${i18n[currentLang].retry}</button>
                    </div>
                `;
                return;
            }

            if (!data || data.length === 0) {
                gridEl.innerHTML = `
                    <div class="col-span-full rounded-2xl border border-dashed border-slate-300 p-6 text-center">
                        <p class="text-slate-500 text-xs">${i18n[currentLang].empty_properties}</p>
                        ${userRole === 'admin' ? `<button type="button" onclick="abrirFormularioPropriedade()" class="mt-3 rounded-xl bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100">${i18n[currentLang].btn_add_property_new}</button>` : ''}
                    </div>
                `;
                return;
            }

            gridEl.innerHTML = data.map(prop => {
                const assignedCleaner = propertyCleaners.find(cleaner => String(cleaner.id) === String(prop.assigned_team_member_id));
                const cleanerName = assignedCleaner?.name || assignedCleaner?.email || 'Sem atribuição';
                return `
                <div class="border border-slate-200/80 bg-slate-50 p-5 rounded-2xl space-y-3 relative group hover:border-indigo-300 transition">
                    <div class="flex justify-between items-start">
                        <div>
                            <h4 class="font-bold text-slate-900 text-sm">${escapePropertyHTML(prop.name)}</h4>
                            <p class="text-xs text-slate-500">${escapePropertyHTML(prop.address || 'Sem morada')}</p>
                        </div>
                        ${userRole === 'admin' ? `
                            <div class="flex items-center gap-1">
                                <button type="button" data-property-id="${escapePropertyHTML(prop.id)}" title="Editar" aria-label="Editar ${escapePropertyHTML(prop.name)}" class="edit-property-button p-2 text-slate-400 hover:text-indigo-600 transition">✏️</button>
                                <button type="button" data-property-id="${escapePropertyHTML(prop.id)}" title="Apagar" aria-label="Apagar ${escapePropertyHTML(prop.name)}" class="delete-property-button p-2 text-slate-400 hover:text-rose-600 transition">🗑️</button>
                            </div>
                        ` : ''}
                    </div>
                    <div class="flex items-center gap-2 flex-wrap text-[11px]">
                        <span class="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg font-bold border border-indigo-100">${i18n[currentLang].property_access_label} ${escapePropertyHTML(prop.access_code || 'N/A')}</span>
                        <span class="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg font-bold border border-emerald-100">💶 ${escapePropertyHTML(prop.hourly_rate || 10.00)}€/h</span>
                    </div>
                    ${prop.instructions ? `<p class="text-[11px] text-slate-500 break-words">${escapePropertyHTML(prop.instructions)}</p>` : ''}
                    <p class="text-[11px] text-slate-600"><span class="font-bold">${i18n[currentLang].property_cleaner_label}</span> ${escapePropertyHTML(cleanerName)}</p>
                    ${userRole === 'admin' ? `<div class="text-[10px] text-emerald-700 font-mono truncate bg-white p-2 rounded-lg border border-slate-200">🔗 ${escapePropertyHTML(prop.ical_url || 'Sem link iCal')}</div>` : ''}
                </div>
            `;
            }).join('');

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
            if (!requireAdminAction()) return;
            editingPropertyId = property.id;
            document.getElementById('prop-name').value = property.name || '';
            document.getElementById('prop-address').value = property.address || '';
            document.getElementById('prop-access').value = property.access_code || '';
            document.getElementById('prop-ical').value = property.ical_url || '';
            document.getElementById('prop-instructions').value = property.instructions || '';
            document.getElementById('prop-rate').value = property.hourly_rate || 10;
            document.getElementById('prop-assigned-cleaner').value = property.assigned_team_member_id || '';

            document.getElementById('property-form-title').innerText = "Editar Alojamento";
            document.getElementById('cancel-edit-btn').classList.remove('hidden');
            hidePropertyMessage('property-form-message');

            const submitBtn = document.getElementById('prop-submit-btn');
            submitBtn.innerText = "Atualizar Alojamento";
            submitBtn.className = "md:col-span-2 bg-amber-500 hover:bg-amber-600 text-white font-bold p-3.5 rounded-xl text-xs transition shadow-lg shadow-amber-500/20";
            
            switchTab('sub-properties-add');
        }

        function resetPropertyForm() {
            if (!requireAdminAction()) return;
            editingPropertyId = null;
            document.getElementById('property-form').reset();
            document.getElementById('prop-rate').value = "10.00";
            document.getElementById('prop-assigned-cleaner').value = '';
            document.getElementById('property-form-title').innerText = i18n[currentLang].title_add_property;
            document.getElementById('cancel-edit-btn').classList.add('hidden');
            hidePropertyMessage('property-form-message');

            const submitBtn = document.getElementById('prop-submit-btn');
            submitBtn.innerText = i18n[currentLang].btn_save_property;
            submitBtn.className = "md:col-span-2 gradient-bg hover:opacity-95 text-white font-bold p-3.5 rounded-xl text-xs transition shadow-lg shadow-indigo-500/30";
        }

        function abrirFormularioPropriedade() {
            if (!requireAdminAction()) return;
            resetPropertyForm();
            switchTab('sub-properties-add');
        }

        async function deleteProperty(propId) {
            if (!requireAdminAction()) return;
            if (!confirm('Deseja mesmo apagar este alojamento?')) return;
            const { error } = await supabaseClient.from('properties').delete().eq('id', propId);
            if (error) {
                alert('Erro ao apagar alojamento: ' + error.message);
                return;
            }
            await loadData();
        }

        function parseLocalDate(dateString) {
            const [year, month, day] = dateString.split('-').map(Number);
            return new Date(year, month - 1, day, 12);
        }

        function getAgendaDateRange() {
            const date = calendarMode === 'day' ? parseLocalDate(selectedDate) : new Date(currentCalendarDate);
            if (calendarMode === 'day') return { start: selectedDate, end: selectedDate };
            if (calendarMode === 'month') {
                return {
                    start: getLocalDateString(new Date(date.getFullYear(), date.getMonth(), 1, 12)),
                    end: getLocalDateString(new Date(date.getFullYear(), date.getMonth() + 1, 0, 12))
                };
            }
            const startDate = new Date(date);
            startDate.setDate(startDate.getDate() - startDate.getDay());
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 6);
            return { start: getLocalDateString(startDate), end: getLocalDateString(endDate) };
        }

        function onCalendarPropertyFilterChange(val) {
            selectedPropertyFilter = val;
            fetchAgendaTasks();
        }

        function onDateFilterChange(val) {
            if (!val) return;
            selectedDate = val;
            currentCalendarDate = parseLocalDate(val);
            fetchAgendaTasks();
        }

        function renderAgendaSummary() {
            const today = getLocalDateString();
            const todayTasks = allTasksCache.filter(task =>
                task.scheduled_date === today &&
                (selectedPropertyFilter === 'all' || String(task.property_id) === String(selectedPropertyFilter))
            );
            document.getElementById('agenda-today-total').innerText = String(todayTasks.length);
            document.getElementById('agenda-today-completed').innerText =
                String(todayTasks.filter(task => task.status === 'completed').length);
            document.getElementById('agenda-today-pending').innerText =
                String(todayTasks.filter(task => task.status === 'pending').length);
        }

        async function fetchAgendaTasks() {
            const listContainer = document.getElementById('tasks-list-container');
            const calendarContainer = document.getElementById('calendar-grid-container');
            if (!listContainer || !calendarContainer) return;
            const requestId = ++agendaRequestId;
            const { start, end } = getAgendaDateRange();
            listContainer.innerHTML = `<p class="text-slate-400 text-xs">${i18n[currentLang].agenda_loading}</p>`;
            document.getElementById('calendar-grid').innerHTML =
                `<div class="col-span-7 py-6 text-center text-slate-400 text-xs">${i18n[currentLang].agenda_loading}</div>`;

            let query = supabaseClient
                .from('cleaning_tasks')
                .select('*, properties!inner(name, address, access_code, instructions, hourly_rate, user_id)')
                .gte('scheduled_date', start)
                .lte('scheduled_date', end)
                .order('scheduled_date', { ascending: true });
            if (selectedPropertyFilter !== 'all') query = query.eq('property_id', selectedPropertyFilter);

            const { data, error } = await query;
            if (requestId !== agendaRequestId) return;
            if (error) {
                console.error('Erro ao carregar tarefas da agenda:', error);
                const errorHTML = `<div class="py-6 text-center" role="alert"><p class="text-rose-600 text-xs">${i18n[currentLang].agenda_load_error}: ${escapePropertyHTML(error.message)}</p></div>`;
                listContainer.innerHTML = errorHTML;
                document.getElementById('calendar-grid').innerHTML = `<div class="col-span-7">${errorHTML}</div>`;
                renderAgendaSummary();
                return;
            }

            agendaTasksCache = data || [];
            renderAgendaSummary();
            renderAgendaView();
        }

        function renderAgendaTasks() {
            const container = document.getElementById('tasks-list-container');
            if (!container) return;
            const filtered = agendaTasksCache;

            if (filtered.length === 0) {
                container.innerHTML = `
                    <div class="py-6 text-center space-y-3">
                        <p class="text-slate-400 text-xs">${i18n[currentLang].agenda_no_tasks}</p>
                        ${userRole === 'admin' ? `
                            <button type="button" onclick="openAddCleaningModal('${selectedDate}')" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-4 py-2 rounded-xl text-xs border border-indigo-200 transition">
                                ➕ ${i18n[currentLang].btn_add_cleaning} ${selectedDate}
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
            if (!requireAdminAction()) return;
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
            if (!requireAdminAction()) return;
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
                currentCalendarDate = parseLocalDate(scheduled_date);
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

        function renderTaskPermissionModules(task, preferences, photos = [], photoLoadError = null) {
            const taskId = escapePropertyHTML(task.id);
            const legacyPhotos = [
                task.photo_before_url && { url: task.photo_before_url, label: currentLang === 'pt' ? 'Entrada (antes)' : 'Arrival (before)' },
                task.photo_after_url && { url: task.photo_after_url, label: currentLang === 'pt' ? 'Saída (depois)' : 'Departure (after)' }
            ].filter(Boolean);
            const galleryPhotos = [
                ...legacyPhotos,
                ...photos.map(photo => ({
                    url: photo.photo_url,
                    label: new Date(photo.created_at).toLocaleDateString(currentLang === 'pt' ? 'pt-PT' : 'en-US')
                }))
            ];
            return `
                <div class="space-y-3 pt-2 border-t border-slate-100">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span class="block font-bold text-slate-700">📸 ${i18n[currentLang].photo_gallery}</span>
                        ${userRole === 'admin' ? `
                            <label for="task-photo-input-${taskId}" class="cursor-pointer rounded-xl bg-indigo-50 px-3 py-2 text-center text-[11px] font-bold text-indigo-700 hover:bg-indigo-100">
                                ${i18n[currentLang].photo_upload}
                            </label>
                            <input id="task-photo-input-${taskId}" type="file" accept="image/*" capture="environment" class="sr-only" onchange="handleTaskPhotoUpload(event, '${taskId}', '${escapePropertyHTML(task.property_id)}')">
                        ` : ''}
                    </div>
                    ${preferences.require_photos ? `<p class="text-[11px] text-amber-700">${currentLang === 'pt' ? 'A equipa deve anexar fotografias antes e depois da limpeza.' : 'The team should attach photos before and after cleaning.'}</p>` : ''}
                    ${photoLoadError ? `<p class="text-[11px] text-rose-600" role="alert">${i18n[currentLang].photo_upload_error}: ${escapePropertyHTML(photoLoadError)}</p>` : ''}
                    <p id="task-photo-message" role="status" aria-live="polite" class="hidden text-[11px] font-semibold"></p>
                    <div id="task-photo-gallery" class="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        ${galleryPhotos.length ? galleryPhotos.map(photo => `
                            <a href="${escapePropertyHTML(photo.url)}" target="_blank" rel="noopener" class="group block overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                                <img src="${escapePropertyHTML(photo.url)}" alt="${escapePropertyHTML(photo.label)}" loading="lazy" class="h-24 w-full object-cover transition group-hover:scale-105">
                                <span class="block truncate px-2 py-1 text-[10px] text-slate-500">${escapePropertyHTML(photo.label)}</span>
                            </a>
                        `).join('') : `<p class="col-span-full text-[11px] text-slate-400">${i18n[currentLang].photo_empty}</p>`}
                    </div>
                </div>
                ${preferences.track_hours && userRole === 'admin' ? `
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

            const taskNotes = document.getElementById('task-notes');
            taskNotes.value = task.cleaner_notes || '';
            taskNotes.readOnly = userRole !== 'admin';
            taskNotes.classList.toggle('bg-slate-100', userRole !== 'admin');
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

            let taskPhotos = [];
            let photoLoadError = null;
            const { data: photoData, error: photoError } = await supabaseClient
                .from('cleaning_task_photos')
                .select('id, photo_url, created_at')
                .eq('task_id', task.id)
                .order('created_at', { ascending: false });
            if (photoError) {
                console.error('Erro ao carregar fotografias da tarefa:', photoError);
                photoLoadError = photoError.message;
            } else {
                taskPhotos = photoData || [];
            }

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
                        <select id="modal-status-${task.id}" ${userRole !== 'admin' ? 'disabled' : ''} class="w-full border border-slate-200 p-2.5 rounded-xl font-bold bg-white text-xs disabled:bg-slate-100 disabled:text-slate-500">
                            <option value="pending" ${task.status === 'pending' ? 'selected' : ''}>⏳ Pendente</option>
                            <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>🔄 Em Andamento</option>
                            <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>🟢 Concluída</option>
                        </select>
                    </div>

                    <div id="task-permission-modules"></div>
                    ${userRole === 'admin' ? `<button onclick="saveTaskModalDetails('${task.id}')" class="w-full gradient-bg hover:opacity-95 text-white font-bold p-3 rounded-xl text-xs transition shadow-md mt-3">Guardar Alterações</button>` : ''}
                </div>
            `;

            const renderPermissionModules = () => {
                document.getElementById('task-permission-modules').innerHTML =
                    renderTaskPermissionModules(task, getAssignedPreferences(), taskPhotos, photoLoadError);
            };
            renderPermissionModules();
            if (userRole === 'admin') {
                assignmentSelect.onchange = renderPermissionModules;
            }
            document.getElementById('task-modal').classList.remove('hidden');
        }

        async function uploadFotoLimpeza(file, propertyId, taskId) {
            if (!requireAdminAction()) throw new Error(i18n[currentLang].role_locked);
            if (!currentUser) throw new Error('É necessário iniciar sessão para anexar fotografias.');
            if (!file || !file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) {
                throw new Error(i18n[currentLang].photo_upload_type_error);
            }

            const extensionByType = {
                'image/jpeg': 'jpg',
                'image/png': 'png',
                'image/webp': 'webp',
                'image/gif': 'gif',
                'image/heic': 'heic',
                'image/heif': 'heif'
            };
            const extension = extensionByType[file.type.toLowerCase()];
            if (!extension) throw new Error(i18n[currentLang].photo_upload_type_error);

            const fileName = `${currentUser.id}/${propertyId}/${taskId}/${crypto.randomUUID()}.${extension}`;
            const storage = supabaseClient.storage.from('cleaning-photos');
            const { error: uploadError } = await storage.upload(fileName, file, {
                contentType: file.type,
                upsert: false
            });
            if (uploadError) throw uploadError;

            const { data: publicUrlData } = storage.getPublicUrl(fileName);
            const photoUrl = publicUrlData.publicUrl;
            const { error: insertError } = await supabaseClient
                .from('cleaning_task_photos')
                .insert([{
                    property_id: propertyId,
                    task_id: taskId,
                    uploaded_by: currentUser.id,
                    photo_url: photoUrl,
                    storage_path: fileName
                }]);
            if (insertError) throw insertError;

            return photoUrl;
        }

        async function handleTaskPhotoUpload(event, taskId, propertyId) {
            if (userRole !== 'admin') {
                alert(i18n[currentLang].role_locked);
                return;
            }
            const file = event.target.files?.[0];
            if (!file) return;

            const input = event.target;
            const task = allTasksCache.find(item => String(item.id) === String(taskId));
            const message = document.getElementById('task-photo-message');
            input.disabled = true;
            if (message) {
                message.innerText = i18n[currentLang].photo_uploading;
                message.className = 'text-[11px] font-semibold text-slate-500';
            }
            try {
                await uploadFotoLimpeza(file, propertyId, taskId);
                if (!task) throw new Error('A tarefa não está disponível para atualizar a galeria.');
                await openTaskModal(task);
                const refreshedMessage = document.getElementById('task-photo-message');
                if (refreshedMessage) {
                    refreshedMessage.innerText = i18n[currentLang].photo_upload_success;
                    refreshedMessage.className = 'text-[11px] font-semibold text-emerald-700';
                }
            } catch (error) {
                console.error('Erro ao anexar fotografia à tarefa:', error);
                if (message) {
                    message.innerText = `${i18n[currentLang].photo_upload_error}: ${error.message}`;
                    message.className = 'text-[11px] font-semibold text-rose-600';
                } else {
                    alert(`${i18n[currentLang].photo_upload_error}: ${error.message}`);
                }
            } finally {
                input.disabled = false;
                input.value = '';
            }
        }

        async function uploadTaskPhoto(event, taskId, photoField) {
            if (!requireAdminAction()) return;
            const file = event.target.files?.[0];
            const task = allTasksCache.find(item => String(item.id) === String(taskId));
            if (!file || !task) return;
            try {
                const photoUrl = await uploadFotoLimpeza(file, task.property_id, taskId);
                const { error } = await supabaseClient
                    .from('cleaning_tasks')
                    .update({ [photoField]: photoUrl })
                    .eq('id', taskId);
                if (error) throw error;
                await loadData();
                await openTaskModal(task);
            } catch (error) {
                console.error('Erro ao guardar fotografia da tarefa:', error);
                alert(`${i18n[currentLang].photo_upload_error}: ${error.message}`);
            } finally {
                event.target.value = '';
            }
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
            if (!requireAdminAction()) return;
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
            if (!requireAdminAction()) return;
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

        function formatFinancialAmount(amount) {
            return new Intl.NumberFormat(currentLang === 'pt' ? 'pt-PT' : 'en-US', {
                style: 'currency',
                currency: 'EUR'
            }).format(amount);
        }

        async function carregarRegistosHoras() {
            const listEl = document.getElementById('time-entries-list');
            const propertySelect = document.getElementById('time-entry-property');
            if (!listEl || !currentUser) return;

            listEl.innerHTML = `<p class="text-slate-400 text-xs">${i18n[currentLang].time_entries_loading}</p>`;
            if (propertySelect) {
                propertySelect.replaceChildren(
                    new Option(i18n[currentLang].time_entry_no_property, ''),
                    ...allPropertiesCache.map(property => new Option(property.name, property.id))
                );
            }

            let query = supabaseClient
                .from('work_time_entries')
                .select('id, work_date, hours, description, team_members(name), properties(name)')
                .order('work_date', { ascending: false })
                .order('created_at', { ascending: false });
            query = userRole === 'admin'
                ? query.eq('manager_id', currentUser.id)
                : query.eq('user_id', currentUser.id);

            const { data, error } = await query;
            if (error) {
                console.error('Erro ao carregar registos de horas:', error);
                listEl.innerHTML = `<p class="text-rose-600 text-xs" role="alert">${i18n[currentLang].time_entry_error}: ${escapePropertyHTML(error.message)}</p>`;
                return;
            }
            if (!data || data.length === 0) {
                listEl.innerHTML = `<p class="text-slate-400 text-xs">${i18n[currentLang].time_entries_empty}</p>`;
                return;
            }

            listEl.innerHTML = data.map(entry => `
                <article class="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-xs">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                        <strong class="text-slate-900">${escapePropertyHTML(entry.properties?.name || i18n[currentLang].time_entry_property)}</strong>
                        <span class="rounded-full bg-indigo-50 px-2.5 py-1 font-bold text-indigo-700">${escapePropertyHTML(entry.hours)}h</span>
                    </div>
                    <p class="mt-1 text-[11px] text-slate-500">${escapePropertyHTML(entry.work_date)}${userRole === 'admin' && entry.team_members?.name ? ` · ${escapePropertyHTML(entry.team_members.name)}` : ''}</p>
                    <p class="mt-2 whitespace-pre-wrap text-slate-700">${escapePropertyHTML(entry.description)}</p>
                </article>
            `).join('');
        }

        async function registarHorasTrabalhadas(event) {
            event.preventDefault();
            if (!currentUser || userRole !== 'cleaner' || !currentTeamMemberId || !currentTeamManagerId) {
                showPropertyMessage('time-entry-message', i18n[currentLang].time_entry_member_error, 'error');
                return;
            }

            const submitButton = document.getElementById('time-entry-submit');
            const hours = Number(document.getElementById('time-entry-hours').value);
            const description = document.getElementById('time-entry-description').value.trim();
            const workDate = document.getElementById('time-entry-date').value;
            const propertyId = document.getElementById('time-entry-property').value || null;
            if (!Number.isFinite(hours) || hours <= 0 || hours > 24 || !description || !workDate) {
                showPropertyMessage('time-entry-message', i18n[currentLang].time_entry_validation, 'error');
                return;
            }

            submitButton.disabled = true;
            hidePropertyMessage('time-entry-message');
            try {
                const { error } = await supabaseClient.from('work_time_entries').insert([{
                    team_member_id: currentTeamMemberId,
                    user_id: currentUser.id,
                    manager_id: currentTeamManagerId,
                    property_id: propertyId,
                    work_date: workDate,
                    hours,
                    description
                }]);
                if (error) throw error;

                document.getElementById('time-entry-form').reset();
                document.getElementById('time-entry-date').value = getLocalDateString();
                await carregarRegistosHoras();
                showPropertyMessage('time-entry-message', i18n[currentLang].time_entry_saved, 'success');
            } catch (error) {
                console.error('Erro ao registar horas trabalhadas:', error);
                showPropertyMessage('time-entry-message', `${i18n[currentLang].time_entry_error}: ${error.message}`, 'error');
            } finally {
                submitButton.disabled = false;
            }
        }

        async function carregarRelatorios() {
            const cardsEl = document.getElementById('reports-summary-cards');
            const propertyListEl = document.getElementById('reports-property-list');
            const propertySelect = document.getElementById('financial-property');
            if (!cardsEl || !propertyListEl || userRole !== 'admin' || !currentUser) return;

            cardsEl.innerHTML = `<p class="text-slate-400 text-xs">${i18n[currentLang].reports_loading}</p>`;
            propertyListEl.innerHTML = `<p class="text-slate-400 text-xs">${i18n[currentLang].reports_loading}</p>`;
            hidePropertyMessage('reports-summary-message');

            try {
                const [propertiesResult, entriesResult, tasksResult] = await Promise.all([
                    supabaseClient
                        .from('properties')
                        .select('id, name')
                        .eq('user_id', currentUser.id),
                    supabaseClient
                        .from('property_financial_entries')
                        .select('property_id, entry_type, amount')
                        .eq('user_id', currentUser.id),
                    supabaseClient
                        .from('cleaning_tasks')
                        .select('property_id, properties!inner(user_id)')
                        .eq('properties.user_id', currentUser.id)
                ]);
                if (propertiesResult.error) throw propertiesResult.error;
                if (entriesResult.error) throw entriesResult.error;
                if (tasksResult.error) throw tasksResult.error;

                const properties = propertiesResult.data || [];
                const entries = entriesResult.data || [];
                const tasks = tasksResult.data || [];
                const metricsByProperty = new Map(properties.map(property => [String(property.id), {
                    property,
                    income: 0,
                    expenses: 0,
                    cleaningCount: 0
                }]));

                entries.forEach(entry => {
                    const metric = metricsByProperty.get(String(entry.property_id));
                    if (!metric) return;
                    if (entry.entry_type === 'income') metric.income += Number(entry.amount);
                    else metric.expenses += Number(entry.amount);
                });
                tasks.forEach(task => {
                    const metric = metricsByProperty.get(String(task.property_id));
                    if (metric) metric.cleaningCount += 1;
                });

                const metrics = [...metricsByProperty.values()];
                const totals = metrics.reduce((sum, metric) => ({
                    income: sum.income + metric.income,
                    expenses: sum.expenses + metric.expenses
                }), { income: 0, expenses: 0 });
                const mostRequested = metrics.reduce((top, metric) =>
                    metric.cleaningCount > (top?.cleaningCount || 0) ? metric : top, null);

                cardsEl.innerHTML = `
                    <article class="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                        <p class="text-[11px] font-bold text-emerald-700">${i18n[currentLang].reports_income_total}</p>
                        <p class="mt-1 text-lg font-extrabold text-emerald-900">${formatFinancialAmount(totals.income)}</p>
                    </article>
                    <article class="rounded-2xl border border-rose-100 bg-rose-50 p-4">
                        <p class="text-[11px] font-bold text-rose-700">${i18n[currentLang].reports_expense_total}</p>
                        <p class="mt-1 text-lg font-extrabold text-rose-900">${formatFinancialAmount(totals.expenses)}</p>
                    </article>
                    <article class="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
                        <p class="text-[11px] font-bold text-indigo-700">${i18n[currentLang].reports_net_total}</p>
                        <p class="mt-1 text-lg font-extrabold text-indigo-900">${formatFinancialAmount(totals.income - totals.expenses)}</p>
                    </article>
                    <article class="rounded-2xl border border-amber-100 bg-amber-50 p-4 sm:col-span-3">
                        <p class="text-[11px] font-bold text-amber-700">${i18n[currentLang].reports_most_requested}</p>
                        <p class="mt-1 text-sm font-extrabold text-amber-900">${escapePropertyHTML(mostRequested?.cleaningCount ? mostRequested.property.name : i18n[currentLang].reports_no_cleanings)}</p>
                        ${mostRequested?.cleaningCount ? `<p class="mt-1 text-[11px] text-amber-800">${mostRequested.cleaningCount} ${i18n[currentLang].reports_cleanings_count}</p>` : ''}
                    </article>
                `;

                if (!metrics.length) {
                    propertyListEl.innerHTML = `<p class="text-slate-400 text-xs">${i18n[currentLang].reports_empty}</p>`;
                } else {
                    propertyListEl.innerHTML = metrics.map(metric => `
                        <article class="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <h5 class="text-xs font-bold text-slate-900">${escapePropertyHTML(metric.property.name)}</h5>
                            <div class="grid grid-cols-2 gap-2 text-[11px]">
                                <p class="text-emerald-700">${i18n[currentLang].reports_income_total}: <strong>${formatFinancialAmount(metric.income)}</strong></p>
                                <p class="text-rose-700">${i18n[currentLang].reports_expense_total}: <strong>${formatFinancialAmount(metric.expenses)}</strong></p>
                                <p class="font-bold text-indigo-700">${i18n[currentLang].reports_net_total}: <strong>${formatFinancialAmount(metric.income - metric.expenses)}</strong></p>
                                <p class="text-slate-600">${metric.cleaningCount} ${i18n[currentLang].reports_cleanings_count}</p>
                            </div>
                        </article>
                    `).join('');
                }

                if (propertySelect) {
                    const selectedId = propertySelect.value;
                    propertySelect.replaceChildren(
                        new Option(i18n[currentLang].reports_select_property, ''),
                        ...properties.map(property => new Option(property.name, property.id))
                    );
                    if (properties.some(property => String(property.id) === selectedId)) {
                        propertySelect.value = selectedId;
                    }
                    propertySelect.disabled = properties.length === 0;
                    document.getElementById('financial-entry-submit').disabled = properties.length === 0;
                }
            } catch (error) {
                console.error('Erro ao carregar métricas financeiras:', error);
                cardsEl.replaceChildren();
                propertyListEl.innerHTML = `<p class="text-rose-600 text-xs">${i18n[currentLang].reports_load_error}: ${escapePropertyHTML(error.message)}</p>`;
                showPropertyMessage('reports-summary-message', `${i18n[currentLang].reports_load_error}: ${error.message}`, 'error');
            }
        }

        async function registarMovimentoFinanceiro(event) {
            event.preventDefault();
            if (!currentUser || userRole !== 'admin') {
                showPropertyMessage('financial-entry-message', i18n[currentLang].property_form_access_error, 'error');
                return;
            }

            const propertyId = document.getElementById('financial-property').value;
            const entryType = document.getElementById('financial-type').value;
            const amount = Number(document.getElementById('financial-amount').value);
            const description = document.getElementById('financial-description').value.trim();
            const occurredOn = document.getElementById('financial-date').value;
            if (!propertyId || !['income', 'expense'].includes(entryType) || !Number.isFinite(amount) || amount <= 0 || !description || !occurredOn) {
                showPropertyMessage('financial-entry-message', i18n[currentLang].reports_invalid_entry, 'error');
                return;
            }

            const submitButton = document.getElementById('financial-entry-submit');
            submitButton.disabled = true;
            hidePropertyMessage('financial-entry-message');
            try {
                const { error } = await supabaseClient
                    .from('property_financial_entries')
                    .insert([{
                        property_id: propertyId,
                        user_id: currentUser.id,
                        entry_type: entryType,
                        amount,
                        description,
                        occurred_on: occurredOn
                    }]);
                if (error) throw error;

                document.getElementById('financial-entry-form').reset();
                document.getElementById('financial-date').value = new Date().toISOString().slice(0, 10);
                await carregarRelatorios();
                showPropertyMessage('financial-entry-message', i18n[currentLang].reports_entry_success, 'success');
            } catch (error) {
                console.error('Erro ao registar movimento financeiro:', error);
                showPropertyMessage('financial-entry-message', `${i18n[currentLang].reports_entry_error}: ${error.message}`, 'error');
            } finally {
                submitButton.disabled = false;
            }
        }

        async function togglePaymentStatus(taskId, currentStatus) {
            if (userRole !== 'admin') return;
            const newStatus = currentStatus === 'paid' ? 'pending' : 'paid';
            await supabaseClient.from('cleaning_tasks').update({ payment_status: newStatus }).eq('id', taskId);
            await loadData();
            fetchHistoryAdmin();
        }

        function setCalendarMode(mode) {
            if (!['day', 'week', 'month'].includes(mode)) return;
            calendarMode = mode;
            if (mode === 'day') currentCalendarDate = parseLocalDate(selectedDate);
            else selectedDate = getLocalDateString(currentCalendarDate);
            document.getElementById('calendar-date-picker').value = selectedDate;
            renderAgendaView();
            fetchAgendaTasks();
        }

        function changeCalendarPeriod(direction) {
            currentCalendarDate = calendarMode === 'day'
                ? parseLocalDate(selectedDate)
                : new Date(currentCalendarDate);
            if (calendarMode === 'day') {
                currentCalendarDate.setDate(currentCalendarDate.getDate() + direction);
            } else if (calendarMode === 'week') {
                currentCalendarDate.setDate(currentCalendarDate.getDate() + (direction * 7));
            } else {
                currentCalendarDate.setDate(1);
                currentCalendarDate.setMonth(currentCalendarDate.getMonth() + direction);
            }
            selectedDate = getLocalDateString(currentCalendarDate);
            document.getElementById('calendar-date-picker').value = selectedDate;
            renderAgendaView();
            fetchAgendaTasks();
        }

        function selectAgendaDate(dateString) {
            selectedDate = dateString;
            currentCalendarDate = parseLocalDate(dateString);
            setCalendarMode('day');
        }

        function renderAgendaView() {
            const listContainer = document.getElementById('tasks-list-container');
            const calendarContainer = document.getElementById('calendar-grid-container');
            const titleEl = document.getElementById('calendar-period-title');
            if (!listContainer || !calendarContainer || !titleEl) return;

            const locale = currentLang === 'pt' ? 'pt-PT' : 'en-US';
            const activeDate = calendarMode === 'day' ? parseLocalDate(selectedDate) : currentCalendarDate;
            document.getElementById('calendar-date-picker').value = selectedDate;
            document.getElementById('btn-mode-day').className = modeButtonClass(calendarMode === 'day');
            document.getElementById('btn-mode-week').className = modeButtonClass(calendarMode === 'week');
            document.getElementById('btn-mode-month').className = modeButtonClass(calendarMode === 'month');

            if (calendarMode === 'day') {
                titleEl.innerText = activeDate.toLocaleDateString(locale, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                });
                listContainer.classList.remove('hidden');
                calendarContainer.classList.add('hidden');
                renderAgendaTasks();
                return;
            }

            listContainer.classList.add('hidden');
            calendarContainer.classList.remove('hidden');
            renderOverviewCalendar();
        }

        function modeButtonClass(active) {
            return active
                ? 'flex-1 sm:flex-none px-3 py-1.5 rounded-lg bg-white text-indigo-600 shadow-sm font-bold'
                : 'flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-slate-500 font-bold';
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
                    const dayTasks = agendaTasksCache.filter(t => t.scheduled_date === formattedDate);
                    const isToday = formattedDate === getLocalDateString();

                    grid.innerHTML += `
                        <button type="button" onclick="selectAgendaDate('${formattedDate}')" aria-label="${formattedDate}" class="text-left border ${isToday ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-300' : 'border-slate-200/80 bg-white'} p-1.5 rounded-xl min-h-[75px] md:min-h-[100px] flex flex-col justify-start hover:border-indigo-400 hover:shadow-sm cursor-pointer transition space-y-1">
                            <span class="text-xs font-bold ${isToday ? 'text-indigo-700' : 'text-slate-700'} block text-right pr-0.5">${day}${isToday ? ` · ${i18n[currentLang].agenda_today}` : ''}</span>
                            <div class="space-y-1 overflow-y-auto max-h-[50px] md:max-h-[70px]">
                                ${dayTasks.map(t => `
                                    <div class="text-[9px] bg-indigo-50 text-indigo-700 p-1 rounded-md font-bold truncate border border-indigo-100/60">
                                        🧹 ${t.properties?.name || 'Limpeza'}
                                    </div>
                                `).join('')}
                            </div>
                        </button>
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
                    const formattedDate = getLocalDateString(loopDate);
                    const dayTasks = agendaTasksCache.filter(t => t.scheduled_date === formattedDate);
                    const isToday = formattedDate === getLocalDateString();

                    grid.innerHTML += `
                        <button type="button" onclick="selectAgendaDate('${formattedDate}')" aria-label="${formattedDate}" class="text-left border ${isToday ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-300' : 'border-slate-200/80 bg-white'} p-2 rounded-2xl min-h-[180px] md:min-h-[220px] flex flex-col justify-start hover:border-indigo-400 hover:shadow-sm cursor-pointer transition space-y-1.5">
                            <div class="text-center border-b border-slate-100 pb-1">
                                <span class="text-xs font-extrabold ${isToday ? 'text-indigo-700' : 'text-slate-800'}">${loopDate.getDate()}${isToday ? ` · ${i18n[currentLang].agenda_today}` : ''}</span>
                            </div>
                            <div class="space-y-1 overflow-y-auto max-h-[140px] md:max-h-[170px] pr-0.5">
                                ${dayTasks.map(t => `
                                    <div class="text-[10px] bg-indigo-50 text-indigo-700 p-1.5 rounded-lg font-bold truncate border border-indigo-100/80 shadow-2xs">
                                        🧹 ${t.properties?.name || 'Limpeza'}
                                    </div>
                                `).join('')}
                            </div>
                        </button>
                    `;
                }
            }
        }

        async function forceSyncICalNow() {
            if (!requireAdminAction()) return;
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
            if (!currentUser || userRole !== 'admin') {
                showPropertyMessage('property-form-message', i18n[currentLang].property_form_access_error, 'error');
                return;
            }

            const submitButton = document.getElementById('prop-submit-btn');
            const dados = {
                name: document.getElementById('prop-name').value.trim(),
                address: document.getElementById('prop-address').value.trim(),
                access_code: document.getElementById('prop-access').value.trim(),
                ical_url: document.getElementById('prop-ical').value.trim(),
                instructions: document.getElementById('prop-instructions').value.trim(),
                hourly_rate: Number(document.getElementById('prop-rate').value),
                assigned_team_member_id: document.getElementById('prop-assigned-cleaner').value || null
            };

            if (!dados.name || !dados.address || !Number.isFinite(dados.hourly_rate) || dados.hourly_rate <= 0) {
                showPropertyMessage('property-form-message', i18n[currentLang].property_form_validation_error, 'error');
                return;
            }

            submitButton.disabled = true;
            hidePropertyMessage('property-form-message');
            const wasEditing = Boolean(editingPropertyId);
            try {
                if (editingPropertyId) {
                    const { error } = await supabaseClient
                        .from('properties')
                        .update(dados)
                        .eq('id', editingPropertyId)
                        .eq('user_id', currentUser.id);
                    if (error) throw error;
                } else {
                    await adicionarPropriedade(dados);
                }

                await loadData();
                resetPropertyForm();
                showPropertyMessage(
                    'properties-list-message',
                    wasEditing ? i18n[currentLang].property_update_success : i18n[currentLang].property_add_success,
                    'success'
                );
                switchTab('sub-properties-list');
            } catch (error) {
                console.error('Erro ao guardar propriedade:', error);
                showPropertyMessage('property-form-message', `${i18n[currentLang].property_save_error}: ${error.message}`, 'error');
            } finally {
                submitButton.disabled = false;
            }
        }

        async function adicionarPropriedade(dados) {
            if (!currentUser || userRole !== 'admin') {
                throw new Error('É necessário iniciar sessão como gestor para adicionar uma propriedade.');
            }

            const { error } = await supabaseClient
                .from('properties')
                .insert([{ ...dados, user_id: currentUser.id }]);
            if (error) throw error;
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
