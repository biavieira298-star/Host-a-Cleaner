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
        let operationalPreferences = { track_hours: false, require_photos: false };
        let profileSettingsTab = 'account';
        let currentTeamMemberId = null;
        let taskTeamMembers = [];
        let taskAwaitingTimeConfirmation = null;
        let incidentTaskContext = null;
        let incidentSelectedFiles = [];
        let incidentRequestId = 0;
        let offlineDatabasePromise = null;
        let syncPendingPromise = null;
        let syncRetryTimer = null;
        let syncRetryAttempt = 0;
        let viewRenderRequestId = 0;
        let activeViewRenderPromise = Promise.resolve();
        let reportsRequestId = 0;
        let financialChartRequestId = 0;
        let financialOverviewChart = null;
        let financialChartStartDate = null;
        let financialChartEndDate = null;
        let hostingReportsRequestId = 0;
        let hostingReportsCache = [];
        let globalIncidentHistoryRequestId = 0;
        let globalHistoryPreviewUrls = [];
        let globalIncidentPriorityFilter = 'all';
        const activeOfflineTaskOperations = new Set();
        const propertyHistoryPreviewUrls = new Map();
        let offlinePendingPhotoUrls = [];
        let offlinePendingIncidentUrls = [];
        let isOfflineMode = !navigator.onLine;
        let currentAuthMode = 'login';
        let currentUser = null;
        let currentTeamManagerId = null;
        let pendingTeamInviteToken = null;
        let registrationRole = 'cleaner';
        let registrationRequested = false;
        let propertyCleaners = [];
        let allTeamMembersCache = [];
        let currentLang = localStorage.getItem('host_cleaner_lang') || 'pt';
        
        function getLocalDateString(date = new Date()) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        function normalizeTaskStatus(status) {
            return String(status ?? '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-zA-Z0-9]+/g, '')
                .trim()
                .toLowerCase();
        }

        function isTaskStatus(taskOrStatus, expectedStatuses) {
            const status = typeof taskOrStatus === 'string' ? taskOrStatus : taskOrStatus?.status;
            const normalizedStatus = normalizeTaskStatus(status);
            return expectedStatuses.some(expected => normalizedStatus === normalizeTaskStatus(expected));
        }

        function isTaskCompleted(taskOrStatus) {
            return isTaskStatus(taskOrStatus, ['completed', 'concluida', 'concluido']);
        }

        function isTaskPending(taskOrStatus) {
            return isTaskStatus(taskOrStatus, ['pending', 'pendente']);
        }

        function isTaskInProgress(taskOrStatus) {
            return isTaskStatus(taskOrStatus, ['in_progress', 'inprogress', 'emandamento', 'emcurso']);
        }

        let selectedDate = getLocalDateString();
        let selectedPropertyFilter = 'all';
        let editingPropertyId = null;
        let employeeHoursMonthlyData = [];
        
        let calendarMode = 'day';
        let currentCalendarDate = new Date();
        let allTasksCache = [];
        let agendaTasksCache = [];
        let agendaRequestId = 0;
        let allPropertiesCache = [];
        let isDesktopSidebarCollapsed = false;
        let isMobileDrawerOpen = false;
        let selectedModalDate = null;
        let cancellationPolicyTrigger = null;
        let cancellationPolicyPreviousOverflow = '';

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
                workspace_title: "Painel de trabalho",
                nav_cat_calendar: "📅 Agenda",
                nav_agenda: "Agenda",
                nav_daily_tasks: "Tarefas Diárias (Lista)",
                nav_overview_cal: "Vista Semanal / Mensal",
                nav_history: "Histórico & Notas",
                history_eyebrow: "Registos operacionais",
                history_description: "Consulte incidentes, notas, prioridades e fotografias dos alojamentos.",
                history_priority_filter: "Prioridade",
                history_filter_all: "Todos",
                history_filter_urgent: "Urgentes",
                history_date_filter: "Data",
                history_property_filter: "Alojamento",
                history_all_properties: "Todos os alojamentos",
                history_sort: "Ordenação",
                history_sort_newest: "Mais recentes",
                history_sort_oldest: "Mais antigos",
                history_refresh: "Atualizar",
                history_loading: "A carregar registos...",
                history_empty: "Não foram encontrados registos com estes filtros.",
                history_error: "Não foi possível carregar o histórico",
                history_results_count: "{count} registos",
                history_offline: "Offline — a mostrar apenas registos pendentes neste dispositivo.",
                history_pending_sync: "Por sincronizar",
                history_resolved: "Resolvido",
                history_urgent: "Urgente",
                history_normal: "Normal",
                history_low: "Baixa",
                nav_settings: "Definições",
                nav_add_property: "Adicionar Alojamento",
                nav_manage_properties: "Gestão de Alojamento",
                nav_team_directory: "Equipa (consulta)",
                nav_time_entries: "Registo de Horas",
                nav_my_hours: "As Minhas Horas",
                team_read_only_title: "Equipa",
                time_entries_submitted: "Registos submetidos",
                nav_profile: "Definições de Perfil",
                profile_settings_eyebrow: "Conta e preferências",
                settings_account_tab: "Conta / Palavra-passe",
                settings_preferences_tab: "Preferências Operacionais",
                settings_subscription_tab: "Plano de Subscrição",
                settings_account_heading: "Conta / Palavra-passe",
                settings_preferences_heading: "Preferências Operacionais",
                settings_require_photos: "Pedir fotos de verificação",
                settings_require_photos_help: "Solicitar fotos antes e depois da limpeza.",
                settings_track_hours: "Pedir total de horas",
                settings_track_hours_help: "Solicitar a duração total ao concluir uma limpeza.",
                settings_theme: "Tema",
                theme_light: "Claro",
                theme_dark: "Escuro",
                theme_default: "Padrão",
                settings_save_preferences: "Guardar preferências",
                settings_saved: "Preferências guardadas.",
                settings_save_error: "Não foi possível guardar as preferências",
                settings_load_error: "Não foi possível carregar as preferências",
                settings_theme_saved: "Tema guardado.",
                settings_subscription_heading: "Plano de Subscrição",
                password_min_length: "Mínimo de 6 caracteres",
                password_confirm_placeholder: "Repita a palavra-passe",
                password_mismatch: "As palavras-passe introduzidas não coincidem.",
                password_updated: "Palavra-passe alterada com sucesso.",
                password_update_error: "Não foi possível alterar a palavra-passe",
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
                btn_start_cleaning: "Iniciar Limpeza",
                btn_complete_cleaning: "Concluir Limpeza",
                time_confirmation_title: "Confirmar tempo da limpeza",
                time_confirmation_description: "Confirme o tempo calculado ou ajuste-o antes de concluir.",
                time_confirmation_elapsed: "Tempo decorrido",
                time_confirmation_hours: "Horas",
                time_confirmation_minutes: "Minutos",
                time_confirmation_confirm: "Confirmar Tempo",
                time_confirmation_saving: "A guardar...",
                time_confirmation_error: "Não foi possível concluir a limpeza",
                time_confirmation_invalid: "Indique uma duração válida superior a zero.",
                time_tracking_started: "Limpeza iniciada. O tempo está a ser contado.",
                time_tracking_start_error: "Não foi possível iniciar a limpeza",
                incident_report_button: "⚠️ Reportar Incidente",
                incident_report_title: "Reportar Ocorrência / Danos",
                incident_priority: "Prioridade",
                incident_not_priority: "Não prioritário",
                incident_priority_badge: "Prioritário",
                incident_type: "Tipo de ocorrência",
                incident_kind: "Incidente",
                incident_note: "Nota",
                incident_priority_urgent: "Urgente",
                incident_priority_normal: "Normal",
                incident_priority_low: "Baixa",
                incident_damage: "Dano / Avaria",
                incident_forgotten_item: "Objeto Esquecido",
                incident_description: "Descrição do problema",
                incident_description_placeholder: "Descreva brevemente o que aconteceu",
                incident_description_required: "Escreva uma descrição antes de enviar.",
                incident_photo: "Fotografias (opcional)",
                incident_take_photo: "Tirar fotografia",
                incident_choose_photos: "Escolher da galeria",
                incident_online: "Online — sincronização ativa",
                incident_offline: "Offline — será sincronizado quando a ligação regressar",
                incident_submit: "Enviar Incidente",
                incident_submitting: "A enviar...",
                incident_saved: "Incidente reportado com sucesso.",
                incident_error: "Não foi possível reportar o incidente",
                incident_photo_error: "Selecione imagens compatíveis até 10 MB cada.",
                incident_alerts_title: "Alertas Urgentes",
                incident_alerts_loading: "A carregar alertas...",
                incident_alerts_empty: "Sem ocorrências pendentes.",
                incident_alerts_error: "Não foi possível carregar os alertas",
                property_history_title: "Histórico de Registos & Notas",
                property_history_loading: "A carregar registos...",
                property_history_empty: "Ainda não existem registos para este alojamento.",
                property_history_offline: "Offline: apenas os registos pendentes guardados neste dispositivo estão disponíveis.",
                property_history_error: "Não foi possível carregar o histórico",
                property_history_retry: "Tentar novamente",
                property_history_author: "Por",
                property_history_unknown_author: "Utilizador",
                property_history_pending: "Por sincronizar",
                property_history_resolved: "Resolvido",
                property_history_priority_urgent: "Urgente",
                property_history_priority_normal: "Normal",
                property_history_priority_low: "Baixa",
                incident_resolve: "Marcar como resolvido",
                incident_resolve_error: "Não foi possível resolver o incidente",
                incident_pending: "Pendente",
                incident_resolved: "Resolvido",
                incident_date: "Reportado em",
                incident_close: "Fechar",
                time_task_not_started: "Inicie a limpeza antes de a concluir.",
                time_started_at: "Iniciada em",
                time_duration_total: "Duração confirmada",
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
                nav_cat_finance: "💶 Finanças & Relatórios",
                nav_history_accounts: "Histórico & Contas",
                offline_status: "Modo Offline — {count} itens pendentes de sincronização",
                offline_pending_status: "{count} itens pendentes de sincronização",
                offline_saved: "Guardado neste dispositivo. Será sincronizado quando a ligação regressar.",
                offline_sync_error: "Sincronização pendente. Os dados continuam guardados neste dispositivo.",
                offline_sync_account: "Inicie sessão com a conta que criou estes dados para sincronizar.",
                offline_storage_error: "Não foi possível guardar os dados offline",
                offline_photo_pending: "Fotografia por sincronizar",
                btn_sync_local_data: "Sincronizar fotos e notas",
                task_sync_complete: "Fotos e notas sincronizadas.",
                task_sync_pending: "Alguns dados continuam pendentes de sincronização.",
                task_sync_offline: "Guardado neste dispositivo. Será sincronizado quando a ligação regressar.",
                task_sync_error: "Não foi possível sincronizar os dados",
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
                finance_overview: "Visão geral",
                finance_tab_overview: "Visão Geral",
                finance_tab_reports: "Documentos",
                finance_tab_manual_entries: "Finanças",
                finance_manual_entries_eyebrow: "Gestão financeira",
                finance_filter_month: "Mês",
                finance_filter_property: "Imóvel",
                finance_status: "Estado",
                finance_paid: "Pago",
                finance_pending: "Pendente",
                finance_service_history: "Histórico de serviços e pagamentos",
                finance_new_entry: "Novo lançamento",
                financial_entries_recent: "Lançamentos recentes",
                finance_metric_month_income: "Receitas Totais (Mês)",
                finance_metric_expenses: "Despesas de Limpeza/Manutenção",
                hosting_reports_eyebrow: "Documentos de plataformas",
                hosting_reports_title: "Relatórios & Documentos de Plataformas",
                hosting_platform: "Plataforma",
                hosting_choose_file: "Escolher ou largar um PDF/CSV",
                hosting_file_limit: "PDF ou CSV · máximo 20 MB",
                hosting_upload: "Enviar documento",
                hosting_uploading: "A enviar documento...",
                hosting_documents: "Documentos enviados",
                hosting_no_documents: "Ainda não existem documentos enviados.",
                hosting_file_required: "Selecione um ficheiro PDF ou CSV até 20 MB.",
                hosting_upload_success: "Documento enviado com sucesso.",
                hosting_upload_error: "Não foi possível enviar o documento",
                hosting_no_property: "Sem imóvel associado",
                hosting_airbnb_import_success: "Documento enviado. Ganhos Airbnb importados: {count}; duplicados ignorados: {duplicates}.",
                hosting_airbnb_import_none: "Documento enviado, mas não foram encontrados imóveis correspondentes no relatório. Selecione o imóvel no menu dropdown antes de fazer upload.",
                hosting_airbnb_import_error: "Documento enviado, mas não foi possível importar os ganhos Airbnb",
                hosting_booking_import_success: "Documento enviado. Ganhos Booking.com consolidados: {count}; duplicados ignorados: {duplicates}.",
                hosting_booking_import_none: "Documento enviado, mas não foram encontrados imóveis correspondentes no relatório. Selecione o imóvel no menu dropdown antes de fazer upload.",
                hosting_booking_import_error: "Documento enviado, mas não foi possível importar os ganhos Booking.com",
                financial_entries_loading: "A carregar lançamentos...",
                financial_entries_empty: "Ainda não existem lançamentos.",
                financial_entries_error: "Não foi possível carregar os lançamentos",
                financial_category_required: "Indique uma categoria.",
                property_cleaning_tasks: "Limpezas",
                property_no_cleaning_tasks: "Sem limpezas registadas.",
                property_priority_badge: "Prioritário",
                task_hours_spent: "Total de horas gastas",
                task_hours_invalid: "Indique uma duração válida entre 0,25 e 168 horas.",
                task_photos_verification: "Fotos de verificação",
                hosting_download: "Descarregar",
                hosting_delete: "Eliminar",
                hosting_delete_confirm: "Tem a certeza de que pretende eliminar este documento?",
                hosting_delete_error: "Não foi possível eliminar o documento",
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
                label_notify_team: "📢 Notificar equipa por WhatsApp",
                btn_whatsapp: "💬 Enviar WhatsApp",
                btn_delete_task: "🗑️ Apagar Limpeza",
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
                workspace_title: "Workspace",
                nav_cat_calendar: "📅 Agenda",
                nav_agenda: "Agenda",
                nav_daily_tasks: "Daily Tasks (List)",
                nav_overview_cal: "Weekly / Monthly View",
                nav_history: "History & Notes",
                history_eyebrow: "Operational records",
                history_description: "Browse property incidents, notes, priorities, and photos.",
                history_priority_filter: "Priority",
                history_filter_all: "All",
                history_filter_urgent: "Urgent",
                history_date_filter: "Date",
                history_property_filter: "Property",
                history_all_properties: "All properties",
                history_sort: "Sort",
                history_sort_newest: "Newest first",
                history_sort_oldest: "Oldest first",
                history_refresh: "Refresh",
                history_loading: "Loading records...",
                history_empty: "No records match these filters.",
                history_error: "Could not load history",
                history_results_count: "{count} records",
                history_offline: "Offline — showing only pending records on this device.",
                history_pending_sync: "Pending sync",
                history_resolved: "Resolved",
                history_urgent: "Urgent",
                history_normal: "Normal",
                history_low: "Low",
                nav_settings: "Settings",
                nav_add_property: "Add Property",
                nav_manage_properties: "Property Management",
                nav_team_directory: "Team (read-only)",
                nav_time_entries: "Work Hours",
                nav_my_hours: "My Hours",
                team_read_only_title: "Team",
                time_entries_submitted: "Submitted entries",
                nav_profile: "Profile Settings",
                profile_settings_eyebrow: "Account and preferences",
                settings_account_tab: "Account / Password",
                settings_preferences_tab: "Operational Preferences",
                settings_subscription_tab: "Subscription Plan",
                settings_account_heading: "Account / Password",
                settings_preferences_heading: "Operational Preferences",
                settings_require_photos: "Request verification photos",
                settings_require_photos_help: "Request before and after cleaning photos.",
                settings_track_hours: "Request total hours",
                settings_track_hours_help: "Request total cleaning duration when a task is completed.",
                settings_theme: "Theme",
                theme_light: "Light",
                theme_dark: "Dark",
                theme_default: "Default",
                settings_save_preferences: "Save preferences",
                settings_saved: "Preferences saved.",
                settings_save_error: "Could not save preferences",
                settings_load_error: "Could not load preferences",
                settings_theme_saved: "Theme saved.",
                settings_subscription_heading: "Subscription Plan",
                password_min_length: "At least 6 characters",
                password_confirm_placeholder: "Repeat the password",
                password_mismatch: "The passwords do not match.",
                password_updated: "Password updated successfully.",
                password_update_error: "Could not update the password",
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
                btn_start_cleaning: "Start Cleaning",
                btn_complete_cleaning: "Complete Cleaning",
                time_confirmation_title: "Confirm cleaning time",
                time_confirmation_description: "Confirm the calculated time or adjust it before completing.",
                time_confirmation_elapsed: "Elapsed time",
                time_confirmation_hours: "Hours",
                time_confirmation_minutes: "Minutes",
                time_confirmation_confirm: "Confirm Time",
                time_confirmation_saving: "Saving...",
                time_confirmation_error: "Could not complete the cleaning",
                time_confirmation_invalid: "Enter a valid duration greater than zero.",
                time_tracking_started: "Cleaning started. Time is now being tracked.",
                time_tracking_start_error: "Could not start the cleaning",
                incident_report_button: "⚠️ Report Incident",
                incident_report_title: "Report Incident / Damage",
                incident_priority: "Priority",
                incident_not_priority: "Not a priority",
                incident_priority_badge: "Priority",
                incident_type: "Incident type",
                incident_kind: "Incident",
                incident_note: "Note",
                incident_priority_urgent: "Urgent",
                incident_priority_normal: "Normal",
                incident_priority_low: "Low",
                incident_damage: "Damage / Fault",
                incident_forgotten_item: "Forgotten Item",
                incident_description: "Problem description",
                incident_description_placeholder: "Briefly describe what happened",
                incident_description_required: "Enter a description before submitting.",
                incident_photo: "Photos (optional)",
                incident_take_photo: "Take photo",
                incident_choose_photos: "Choose from gallery",
                incident_online: "Online — sync active",
                incident_offline: "Offline — will sync when connection returns",
                incident_submit: "Submit Incident",
                incident_submitting: "Submitting...",
                incident_saved: "Incident reported successfully.",
                incident_error: "Could not report the incident",
                incident_photo_error: "Select supported images up to 10 MB each.",
                incident_alerts_title: "Urgent Alerts",
                incident_alerts_loading: "Loading alerts...",
                incident_alerts_empty: "No pending incidents.",
                incident_alerts_error: "Could not load alerts",
                property_history_title: "Records & Notes History",
                property_history_loading: "Loading records...",
                property_history_empty: "There are no records for this property yet.",
                property_history_offline: "Offline: only pending records saved on this device are available.",
                property_history_error: "Could not load history",
                property_history_retry: "Try again",
                property_history_author: "By",
                property_history_unknown_author: "User",
                property_history_pending: "Pending sync",
                property_history_resolved: "Resolved",
                property_history_priority_urgent: "Urgent",
                property_history_priority_normal: "Normal",
                property_history_priority_low: "Low",
                incident_resolve: "Mark as resolved",
                incident_resolve_error: "Could not resolve the incident",
                incident_pending: "Pending",
                incident_resolved: "Resolved",
                incident_date: "Reported",
                incident_close: "Close",
                time_task_not_started: "Start the cleaning before completing it.",
                time_started_at: "Started at",
                time_duration_total: "Confirmed duration",
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
                nav_cat_finance: "💶 Finance & Reports",
                nav_history_accounts: "History & Accounts",
                offline_status: "Offline Mode — {count} items waiting to sync",
                offline_pending_status: "{count} items waiting to sync",
                offline_saved: "Saved on this device. It will sync when your connection returns.",
                offline_sync_error: "Sync pending. Your data is still saved on this device.",
                offline_sync_account: "Sign in with the account that created this data to sync it.",
                offline_storage_error: "Could not save data offline",
                offline_photo_pending: "Photo waiting to sync",
                btn_sync_local_data: "Sync photos and notes",
                task_sync_complete: "Photos and notes synced.",
                task_sync_pending: "Some data is still waiting to sync.",
                task_sync_offline: "Saved on this device. It will sync when your connection returns.",
                task_sync_error: "Could not sync the data",
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
                finance_overview: "Overview",
                finance_tab_overview: "Overview",
                finance_tab_reports: "Documents",
                finance_tab_manual_entries: "Entries",
                finance_manual_entries_eyebrow: "Financial management",
                finance_filter_month: "Month",
                finance_filter_property: "Property",
                finance_status: "Status",
                finance_paid: "Paid",
                finance_pending: "Pending",
                finance_service_history: "Service and payment history",
                finance_new_entry: "New entry",
                financial_entries_recent: "Recent entries",
                finance_metric_month_income: "Total Revenue (Month)",
                finance_metric_expenses: "Cleaning/Maintenance Expenses",
                hosting_reports_eyebrow: "Platform documents",
                hosting_reports_title: "Platform Reports & Documents",
                hosting_platform: "Platform",
                hosting_choose_file: "Choose or drop a PDF/CSV",
                hosting_file_limit: "PDF or CSV · 20 MB maximum",
                hosting_upload: "Upload document",
                hosting_uploading: "Uploading document...",
                hosting_documents: "Uploaded documents",
                hosting_no_documents: "No documents have been uploaded yet.",
                hosting_file_required: "Select a PDF or CSV file up to 20 MB.",
                hosting_upload_success: "Document uploaded successfully.",
                hosting_upload_error: "Could not upload the document",
                hosting_no_property: "No property linked",
                hosting_airbnb_import_success: "Document uploaded. Airbnb earnings imported: {count}; duplicates skipped: {duplicates}.",
                hosting_airbnb_import_none: "Document uploaded, but no matching properties were found in the report. Select the property in the dropdown before uploading.",
                hosting_airbnb_import_error: "Document uploaded, but Airbnb earnings could not be imported",
                hosting_booking_import_success: "Document uploaded. Booking.com earnings consolidated: {count}; duplicates skipped: {duplicates}.",
                hosting_booking_import_none: "Document uploaded, but no matching properties were found in the report. Select the property in the dropdown before uploading.",
                hosting_booking_import_error: "Document uploaded, but Booking.com earnings could not be imported",
                financial_entries_loading: "Loading entries...",
                financial_entries_empty: "No entries have been recorded yet.",
                financial_entries_error: "Could not load entries",
                financial_category_required: "Enter a category.",
                property_cleaning_tasks: "Cleanings",
                property_no_cleaning_tasks: "No cleanings recorded.",
                property_priority_badge: "Priority",
                task_hours_spent: "Total hours spent",
                task_hours_invalid: "Enter a valid duration between 0.25 and 168 hours.",
                task_photos_verification: "Verification photos",
                hosting_download: "Download",
                hosting_delete: "Delete",
                hosting_delete_confirm: "Are you sure you want to delete this document?",
                hosting_delete_error: "Could not delete the document",
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
                label_notify_team: "📢 Notify team via WhatsApp",
                btn_whatsapp: "💬 Send WhatsApp",
                btn_delete_task: "🗑️ Delete Task",
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
            document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
                const key = el.getAttribute('data-i18n-aria-label');
                if (i18n[lang] && i18n[lang][key]) el.setAttribute('aria-label', i18n[lang][key]);
            });
            updateIncidentNetworkStatus();

            // Re-renderiza o calendário para atualizar os dias da semana
            if (!document.getElementById('view-sub-agenda').classList.contains('hidden')) renderAgendaView();
            if (userRole === 'admin' && !document.getElementById('view-sub-financial-entries').classList.contains('hidden')) {
                fetchHistoryAdmin();
            }
            if (userRole === 'admin' && ['view-sub-reports', 'view-sub-financial-entries'].some(id =>
                !document.getElementById(id).classList.contains('hidden'))) {
                carregarRelatorios();
            }
            if (userRole === 'admin' && !document.getElementById('view-sub-financial-entries').classList.contains('hidden')) {
                carregarLancamentosManuais();
            }
            if (userRole === 'admin' && !document.getElementById('view-sub-hosting-reports').classList.contains('hidden')) {
                carregarPropriedadesDocumentos();
                carregarDocumentosHosting();
            }
            void updateOfflineIndicator();
            if (!document.getElementById('view-sub-time-entries').classList.contains('hidden')) {
                carregarRegistosHoras();
            }
            if (!document.getElementById('view-history').classList.contains('hidden')) {
                void loadGlobalIncidentHistory();
            }
        }

        async function initApp() {
            changeLanguage(currentLang);
            document.getElementById('calendar-date-picker').value = selectedDate;
            document.getElementById('financial-date').value = getLocalDateString();
            document.getElementById('financial-filter-month').value = getLocalDateString().slice(0, 7);
            document.getElementById('time-entry-date').value = getLocalDateString();
            const { data: { session } } = await supabaseClient.auth.getSession();
            currentUser = session ? session.user : null;

            if (pendingTeamInviteToken) {
                showTeamInviteSignup();
            } else if (registrationRequested) {
                showLoginScreen();
                setAuthMode('signup');
            } else if (currentUser) {
                await initializeAuthenticatedApp();
            } else {
                showLoginScreen();
            }

            supabaseClient.auth.onAuthStateChange(async (event, session) => {
                currentUser = session ? session.user : null;
                if (registrationRequested && event === 'INITIAL_SESSION') return;
                if (currentUser) {
                    await initializeAuthenticatedApp();
                } else {
                    showLoginScreen();
                    void updateOfflineIndicator();
                }
            });
        }

        async function initializeAuthenticatedApp() {
            if (navigator.onLine) {
                try {
                    await checkUserRole();
                    isOfflineMode = false;
                } catch (error) {
                    if (!isOfflineNetworkError(error)) throw error;
                    console.warn('Sem ligação durante a identificação da conta; a usar o estado guardado localmente.');
                    isOfflineMode = true;
                    if (!await restoreOfflineSnapshot()) throw error;
                }
            } else {
                isOfflineMode = true;
                try {
                    const restored = await restoreOfflineSnapshot();
                    if (!restored) {
                        const metadataRole = currentUser.app_metadata?.role;
                        userRole = metadataRole === 'admin' ? 'admin' : 'cleaner';
                    }
                } catch (error) {
                    console.error('Não foi possível restaurar o estado offline:', error);
                    userRole = 'cleaner';
                    await updateOfflineIndicator(`${i18n[currentLang].offline_storage_error}: ${error.message}`);
                }
            }
            showAppLayout();
            await loadData();
            await refreshUrgentIncidentBadge();
            await activeViewRenderPromise;
            if (navigator.onLine) void syncPendingData();
        }

        function isOfflineNetworkError(error) {
            return !navigator.onLine
                || error instanceof TypeError
                || /failed to fetch|networkerror|internet disconnected/i.test(String(error?.message || error));
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
            } else {
                document.getElementById('sidebar-role-subtitle').innerText = "Admin Hub";
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
            restoreOperationalPreferencesFromStorage();
            
            const previousTab = localStorage.getItem('host_cleaner_active_tab');
            const savedTab = ['sub-calendar-daily', 'sub-calendar-overview'].includes(previousTab)
                ? 'sub-agenda'
                : ['sub-financial-movements', 'sub-history'].includes(previousTab)
                    ? 'sub-financial-entries'
                    : previousTab || 'sub-agenda';
            const resolvedTab = savedTab === 'sub-subscriptions' ? 'sub-profile-settings' : savedTab;
            if (savedTab === 'sub-subscriptions') profileSettingsTab = 'subscription';
            if (userRole !== 'admin' && profileSettingsTab === 'subscription') profileSettingsTab = 'account';
            const restrictedTabs = ['sub-properties-add', 'sub-reports', 'sub-hosting-reports', 'sub-financial-entries'];
            if (userRole === 'cleaner' && restrictedTabs.includes(resolvedTab)) {
                switchTab('sub-agenda');
            } else if (userRole === 'admin' && resolvedTab === 'sub-time-entries') {
                switchTab('sub-agenda');
            } else {
                switchTab(resolvedTab);
            }
        }

        async function handleLogout() {
            localStorage.removeItem('host_cleaner_active_tab');
            await supabaseClient.auth.signOut();
            currentUser = null; userRole = 'admin'; showLoginScreen();
        }

        function switchProfileTab(tab) {
            if (!['account', 'operations', 'subscription'].includes(tab)) return;
            if (tab === 'subscription' && userRole !== 'admin') return;
            profileSettingsTab = tab;
            const panels = {
                account: 'profile-subtab-security',
                operations: 'profile-subtab-operations',
                subscription: 'profile-subtab-subscription'
            };
            Object.entries(panels).forEach(([key, panelId]) => {
                const active = key === tab;
                document.getElementById(panelId).classList.toggle('hidden', !active);
                const button = document.getElementById(`btn-profile-tab-${key}`);
                if (!button) return;
                button.setAttribute('aria-selected', String(active));
                button.className = `profile-settings-tab min-w-fit rounded-xl px-3 py-2.5 text-left text-xs transition ${
                    active
                        ? 'bg-indigo-50 font-bold text-indigo-700'
                        : 'font-semibold text-slate-500 hover:bg-slate-50'
                }${key === 'subscription' ? ' admin-only' : ''}`;
            });
        }

        function getOperationalPreferencesStorageKey() {
            return `host_cleaner_operational_preferences_${currentUser?.id || 'anonymous'}`;
        }

        function restoreOperationalPreferencesFromStorage() {
            const savedPreferences = localStorage.getItem(getOperationalPreferencesStorageKey());
            if (!savedPreferences) return false;
            try {
                const parsedPreferences = JSON.parse(savedPreferences);
                operationalPreferences = {
                    track_hours: parsedPreferences.track_hours === true,
                    require_photos: parsedPreferences.require_photos === true
                };
                return true;
            } catch (error) {
                console.error('Preferências operacionais locais inválidas:', error);
                localStorage.removeItem(getOperationalPreferencesStorageKey());
                return false;
            }
        }

        function setProfileSettingsMessage(message, type = 'success') {
            const element = document.getElementById('profile-settings-message');
            if (!element) return;
            element.textContent = message;
            element.className = `text-xs font-semibold ${type === 'error' ? 'text-rose-600' : 'text-emerald-700'}`;
        }

        function setProfilePasswordMessage(message, type = 'success') {
            const element = document.getElementById('profile-password-message');
            if (!element) return;
            element.textContent = message;
            element.className = `text-xs font-semibold ${type === 'error' ? 'text-rose-600' : 'text-emerald-700'}`;
        }

        function applyThemePreference(theme, persist = false) {
            const selectedTheme = ['light', 'dark', 'default'].includes(theme) ? theme : 'default';
            if (theme === 'system') localStorage.setItem('host_cleaner_theme', selectedTheme);
            document.documentElement.dataset.theme = selectedTheme;
            if (document.body) document.body.dataset.theme = selectedTheme;
            const appLayout = document.getElementById('app-layout');
            if (appLayout) appLayout.dataset.theme = selectedTheme;
            const selector = document.getElementById('profile-theme-select');
            if (selector) selector.value = selectedTheme;
            const themeColor = document.querySelector('meta[name="theme-color"]');
            if (themeColor) {
                themeColor.content = selectedTheme === 'dark'
                    ? '#0f172a'
                    : selectedTheme === 'light'
                        ? '#f7f4ec'
                        : '#f0f4f8';
            }
            if (persist) localStorage.setItem('host_cleaner_theme', selectedTheme);
            return selectedTheme;
        }

        function saveThemePreference(theme) {
            const selectedTheme = applyThemePreference(theme, true);
            setProfileSettingsMessage(i18n[currentLang].settings_theme_saved);
            return selectedTheme;
        }

        function applyOperationalPreferencesToInviteForm() {
            const trackHours = document.getElementById('team-track-hours');
            const requirePhotos = document.getElementById('team-require-photos');
            if (trackHours) trackHours.checked = operationalPreferences.track_hours;
            if (requirePhotos) requirePhotos.checked = operationalPreferences.require_photos;
        }

        async function loadProfileSettings() {
            document.getElementById('profile-email-val').textContent = currentUser?.email || '---';
            applyThemePreference(localStorage.getItem('host_cleaner_theme') || 'default');
            const savedPreferences = localStorage.getItem(getOperationalPreferencesStorageKey());
            let storedPreferences = null;
            if (savedPreferences) {
                try {
                    const parsedPreferences = JSON.parse(savedPreferences);
                    storedPreferences = {
                        track_hours: parsedPreferences.track_hours === true,
                        require_photos: parsedPreferences.require_photos === true
                    };
                } catch (error) {
                    console.error('Preferências operacionais locais inválidas:', error);
                    localStorage.removeItem(getOperationalPreferencesStorageKey());
                }
            }

            if (userRole === 'admin' && currentUser) {
                try {
                    const { data: members, error } = await supabaseClient
                        .from('team_members')
                        .select('track_hours, require_photos')
                        .eq('manager_id', currentUser.id)
                        .eq('role', 'cleaner');
                    if (error) throw error;
                    if (members?.length) {
                        operationalPreferences = {
                            track_hours: members.every(member => member.track_hours === true),
                            require_photos: members.every(member => member.require_photos === true)
                        };
                        localStorage.setItem(getOperationalPreferencesStorageKey(), JSON.stringify(operationalPreferences));
                    } else {
                        operationalPreferences = storedPreferences || { track_hours: false, require_photos: false };
                    }
                } catch (error) {
                    console.error('Não foi possível carregar as preferências da equipa:', error);
                    setProfileSettingsMessage(`${i18n[currentLang].settings_load_error}: ${error.message}`, 'error');
                    operationalPreferences = storedPreferences || operationalPreferences;
                }
            } else {
                operationalPreferences = storedPreferences || operationalPreferences;
            }
            document.getElementById('settings-track-hours').checked = operationalPreferences.track_hours;
            document.getElementById('settings-require-photos').checked = operationalPreferences.require_photos;
            applyOperationalPreferencesToInviteForm();
        }

        async function saveOperationalPreferences() {
            if (!requireAdminAction()) return;
            const button = document.getElementById('save-operational-preferences');
            const preferences = {
                track_hours: document.getElementById('settings-track-hours').checked,
                require_photos: document.getElementById('settings-require-photos').checked
            };
            button.disabled = true;
            try {
                const { error } = await supabaseClient
                    .from('team_members')
                    .update(preferences)
                    .eq('manager_id', currentUser.id)
                    .eq('role', 'cleaner');
                if (error) throw error;

                operationalPreferences = preferences;
                localStorage.setItem(getOperationalPreferencesStorageKey(), JSON.stringify(preferences));
                allTeamMembersCache.forEach(member => {
                    if (member.role === 'cleaner') {
                        Object.assign(member, preferences);
                    }
                });
                taskTeamMembers.forEach(member => Object.assign(member, preferences));
                applyOperationalPreferencesToInviteForm();
                setProfileSettingsMessage(i18n[currentLang].settings_saved);
            } catch (error) {
                console.error('Erro ao guardar as preferências operacionais:', error);
                setProfileSettingsMessage(`${i18n[currentLang].settings_save_error}: ${error.message}`, 'error');
            } finally {
                button.disabled = false;
            }
        }

        async function checkSubscriptionLimit(resource) {
            if (!currentUser) {
                alert('Inicie sessão para verificar os limites do seu plano.');
                return false;
            }

            try {
                const limitColumn = resource === 'properties' ? 'max_properties' : 'max_cleaners';
                const { data: profile, error: profileError } = await supabaseClient
                    .from('profiles')
                    .select(`subscription_plan, ${limitColumn}`)
                    .eq('id', currentUser.id)
                    .maybeSingle();
                if (profileError) throw profileError;
                if (!profile) throw new Error('Perfil de subscrição não encontrado.');

                const plan = String(profile.subscription_plan || 'gratuito').trim().toLowerCase();
                const planLabels = {
                    free: 'Gratuito',
                    gratuito: 'Gratuito',
                    starter: 'Starter',
                    pro: 'Pro',
                    business: 'Business'
                };
                const planLabel = planLabels[plan] || profile.subscription_plan || 'Gratuito';
                let limit = profile[limitColumn];

                if (resource === 'cleaners') {
                    if (!['free', 'gratuito', 'starter'].includes(plan)) return true;
                    if (limit === null || limit === undefined || limit === '') {
                        throw new Error(`O limite de cleaners do plano ${planLabel} não está configurado.`);
                    }
                } else if (limit === null || limit === undefined || limit === '') {
                    return true;
                }

                limit = Number(limit);
                if (!Number.isInteger(limit) || limit < 0) {
                    throw new Error(`O limite ${limitColumn} do plano ${planLabel} não é válido.`);
                }

                const table = resource === 'properties' ? 'properties' : 'team_members';
                let countQuery = supabaseClient
                    .from(table)
                    .select('id', { count: 'exact', head: true });
                if (resource === 'properties') {
                    countQuery = countQuery.eq('user_id', currentUser.id);
                } else {
                    countQuery = countQuery
                        .eq('manager_id', currentUser.id)
                        .eq('role', 'cleaner');
                }

                const { count, error: countError } = await countQuery;
                if (countError) throw countError;
                if (count === null) throw new Error('Não foi possível contar os recursos existentes.');
                if (count < limit) return true;

                const nextPlan = {
                    free: 'Starter',
                    gratuito: 'Starter',
                    starter: 'Pro',
                    pro: 'Business',
                    business: 'Business'
                }[plan] || 'Starter';
                const resourceLabel = resource === 'properties' ? 'imóveis' : 'cleaners';
                const upgrade = window.confirm(
                    `Atingiu o limite de ${limit} ${resourceLabel} do plano ${planLabel}. ` +
                    `Faça upgrade para o plano ${nextPlan} para continuar. Deseja ver os planos?`
                );
                if (upgrade) switchTab('sub-subscriptions');
                return false;
            } catch (error) {
                console.error('Erro ao verificar o limite do plano:', error);
                alert(`Não foi possível verificar o limite do plano: ${error.message}`);
                return false;
            }
        }

        async function handleChangePassword(e) {
            e.preventDefault();
            const newPassword = document.getElementById('new-password-input').value;
            const confirmPassword = document.getElementById('confirm-password-input').value;

            if (newPassword !== confirmPassword) {
                setProfilePasswordMessage(i18n[currentLang].password_mismatch, 'error');
                return;
            }

            const btn = document.getElementById('btn-update-pwd');
            btn.disabled = true;
            try {
                const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
                if (error) throw error;
                document.getElementById('new-password-input').value = '';
                document.getElementById('confirm-password-input').value = '';
                setProfilePasswordMessage(i18n[currentLang].password_updated);
            } catch (error) {
                console.error('Erro ao alterar a palavra-passe:', error);
                setProfilePasswordMessage(`${i18n[currentLang].password_update_error}: ${error.message}`, 'error');
            } finally {
                btn.disabled = false;
                btn.innerText = i18n[currentLang].btn_update_pwd;
            }
        }

        function switchTab(subtabId, planLimitChecked = false) {
            closeMenuAfterAction();

            if (subtabId === 'sub-history' || subtabId === 'sub-financial-movements') subtabId = 'sub-financial-entries';
            if (subtabId === 'sub-subscriptions') {
                subtabId = 'sub-profile-settings';
                profileSettingsTab = 'subscription';
            }
            if (userRole !== 'admin' && profileSettingsTab === 'subscription') profileSettingsTab = 'account';
            if (subtabId === 'sub-time-entries' && userRole !== 'cleaner') {
                alert(i18n[currentLang].role_locked);
                return;
            }
            if (subtabId === 'sub-employee-hours' && userRole !== 'admin') {
                alert(i18n[currentLang].role_locked);
                return;
            }

            if (userRole === 'cleaner' && ['sub-properties-add', 'sub-reports', 'sub-hosting-reports', 'sub-financial-entries', 'sub-employee-hours'].includes(subtabId)) {
                alert(i18n[currentLang].role_locked);
                return;
            }

            if (subtabId === 'sub-properties-add' && !editingPropertyId && !planLimitChecked) {
                void checkSubscriptionLimit('properties').then(canCreate => {
                    if (canCreate) switchTab(subtabId, true);
                });
                return;
            }

            if (['sub-properties-list', 'sub-properties-add', 'sub-team-management'].includes(subtabId)) {
                toggleSettingsMenu(true);
            }

            localStorage.setItem('host_cleaner_active_tab', subtabId);

            const tabs = ['sub-agenda', 'history', 'sub-properties-list', 'sub-properties-add', 'sub-reports', 'sub-hosting-reports', 'sub-financial-entries', 'sub-employee-hours', 'sub-team-management', 'sub-time-entries', 'sub-profile-settings'];
            tabs.forEach(t => {
                const el = document.getElementById(`view-${t}`);
                if (el) el.classList.toggle('hidden', t !== subtabId);
                const btn = document.getElementById(t === 'history' ? 'nav-history' : `btn-${t}`);
                if (btn) {
                    const isActive = t === subtabId && !(userRole === 'cleaner' && t === 'sub-team-management');
                    btn.classList.toggle('font-bold', isActive);
                    btn.classList.toggle('font-semibold', !isActive);
                    btn.classList.toggle('bg-indigo-600', isActive);
                    btn.classList.toggle('text-white', isActive);
                    btn.classList.toggle('shadow-lg', isActive);
                    btn.classList.toggle('text-slate-300', !isActive);
                }
            });
            const activeView = document.getElementById(`view-${subtabId}`);
            const currentRenderRequestId = ++viewRenderRequestId;
            if (activeView) {
                activeView.classList.add('app-view', 'is-loading');
                activeView.classList.remove('is-ready');
                activeView.dataset.renderRequest = String(currentRenderRequestId);
                activeView.setAttribute('aria-busy', 'true');
            }
            const viewRenderTasks = [];
            const teamDirectoryButton = document.getElementById('btn-sub-team-directory');
            if (teamDirectoryButton) {
                const directoryStateClass = userRole !== 'cleaner'
                    ? 'hidden text-slate-300'
                    : subtabId === 'sub-team-management'
                        ? 'bg-indigo-600 text-white shadow-lg'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white';
                teamDirectoryButton.className = `cleaner-only ${directoryStateClass} w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap`;
            }

            if (subtabId === 'sub-agenda') viewRenderTasks.push(fetchAgendaTasks());
            if (subtabId === 'history') viewRenderTasks.push(loadGlobalIncidentHistory());
            if (subtabId === 'sub-properties-list') viewRenderTasks.push(carregarPropriedades());
            if (subtabId === 'sub-properties-add' && !editingPropertyId) viewRenderTasks.push(carregarCleaners());
            if (subtabId === 'sub-reports' || subtabId === 'sub-financial-entries') {
                viewRenderTasks.push(carregarRelatorios());
            }
            if (subtabId === 'sub-reports') viewRenderTasks.push(renderFinancialChart());
            if (subtabId === 'sub-financial-entries') {
                viewRenderTasks.push(carregarLancamentosManuais(), fetchHistoryAdmin());
            }
            if (subtabId === 'sub-hosting-reports') {
                carregarPropriedadesDocumentos();
                viewRenderTasks.push(carregarDocumentosHosting());
            }
            if (subtabId === 'sub-team-management') {
                applyOperationalPreferencesToInviteForm();
                viewRenderTasks.push(fetchTeamMembers().then(loaded => {
                    if (!loaded || userRole !== 'admin') return;
                    const hasSavedPreferences = Boolean(localStorage.getItem(getOperationalPreferencesStorageKey()));
                    const cleaners = allTeamMembersCache.filter(member => member.role === 'cleaner');
                    if (!hasSavedPreferences && cleaners.length) {
                        operationalPreferences = {
                            track_hours: cleaners.every(member => member.track_hours === true),
                            require_photos: cleaners.every(member => member.require_photos === true)
                        };
                        localStorage.setItem(getOperationalPreferencesStorageKey(), JSON.stringify(operationalPreferences));
                    }
                    applyOperationalPreferencesToInviteForm();
                }));
            }
            if (subtabId === 'sub-employee-hours') viewRenderTasks.push(renderEmployeeHoursView());
            if (subtabId === 'sub-time-entries') viewRenderTasks.push(carregarRegistosHoras());
            if (subtabId === 'sub-profile-settings') {
                switchProfileTab(profileSettingsTab);
                viewRenderTasks.push(loadProfileSettings());
            }
            activeViewRenderPromise = Promise.allSettled(viewRenderTasks).then(results => {
                results.forEach(result => {
                    if (result.status === 'rejected') {
                        console.error(`Erro ao preparar a vista ${subtabId}:`, result.reason);
                    }
                });
                return new Promise(resolve => requestAnimationFrame(() => {
                    if (activeView
                        && !activeView.classList.contains('hidden')
                        && activeView.dataset.renderRequest === String(currentRenderRequestId)) {
                        activeView.classList.remove('is-loading');
                        activeView.classList.add('is-ready');
                        activeView.setAttribute('aria-busy', 'false');
                    }
                    resolve();
                }));
            });
        }

        async function loadData() {
            if (isOfflineMode || !navigator.onLine) {
                await restoreOfflineSnapshot();
                await fetchAgendaTasks();
                return;
            }
            const propertiesLoaded = await fetchPropertiesForSelect();
            const teamLoaded = await fetchTeamMembers();
            if (userRole === 'admin') await carregarCleaners();
            const tasksLoaded = await fetchAllTasksCache();
            if (!propertiesLoaded || !tasksLoaded || teamLoaded === false) {
                isOfflineMode = true;
                await restoreOfflineSnapshot();
                await updateOfflineIndicator();
                return;
            }
            await carregarPropriedades();
            await fetchAgendaTasks();
            try {
                await saveOfflineSnapshot();
            } catch (error) {
                console.error('Não foi possível atualizar a cópia offline:', error);
            }
            if (userRole === 'admin' && !document.getElementById('view-sub-financial-entries').classList.contains('hidden')) {
                fetchHistoryAdmin();
            }
            if (userRole === 'admin' && ['view-sub-reports', 'view-sub-financial-entries'].some(id =>
                !document.getElementById(id).classList.contains('hidden'))) {
                void carregarRelatorios();
            }
            if (userRole === 'admin' && !document.getElementById('view-sub-financial-entries').classList.contains('hidden')) {
                void carregarLancamentosManuais();
            }
            if (userRole === 'admin' && !document.getElementById('view-sub-reports').classList.contains('hidden')) {
                void renderFinancialChart();
            }
            if (userRole === 'admin' && !document.getElementById('view-sub-hosting-reports').classList.contains('hidden')) {
                carregarPropriedadesDocumentos();
                void carregarDocumentosHosting();
            }
            await refreshUrgentIncidentBadge();
        }

        async function fetchAllTasksCache() {
            if (!navigator.onLine) return allTasksCache.length > 0;
            const { data, error } = await supabaseClient
                .from('cleaning_tasks')
                .select('*, properties!inner(name, address, access_code, instructions, hourly_rate, user_id)');
            if (error) {
                console.error('Erro ao guardar tarefas para uso offline:', error);
                return false;
            }
            allTasksCache = data || [];
            return true;
        }

        async function fetchPropertiesForSelect() {
            const filterSelect = document.getElementById('filter-property-select');
            if (!navigator.onLine) {
                if (filterSelect) {
                    filterSelect.replaceChildren(
                        new Option(i18n[currentLang].opt_all_properties, 'all'),
                        ...allPropertiesCache.map(property => new Option(property.name, property.id))
                    );
                    filterSelect.value = selectedPropertyFilter;
                }
                return allPropertiesCache.length > 0;
            }
            const { data, error } = await supabaseClient.from('properties').select('*');
            if (error) {
                console.error('Erro ao carregar alojamentos para o filtro:', error);
                if (filterSelect && allPropertiesCache.length === 0) {
                    filterSelect.replaceChildren(new Option('Erro ao carregar alojamentos', ''));
                }
                return false;
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
            return true;
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

        function openOfflineDatabase() {
            if (!('indexedDB' in window)) {
                return Promise.reject(new Error('Este navegador não suporta armazenamento offline.'));
            }
            if (!offlineDatabasePromise) {
                offlineDatabasePromise = new Promise((resolve, reject) => {
                    const request = indexedDB.open('host-a-cleaner-offline', 2);
                    request.onupgradeneeded = () => {
                        const database = request.result;
                        if (!database.objectStoreNames.contains('pending')) {
                            database.createObjectStore('pending', { keyPath: 'sequence', autoIncrement: true });
                        }
                        if (!database.objectStoreNames.contains('snapshots')) {
                            database.createObjectStore('snapshots', { keyPath: 'userId' });
                        }
                    };
                    request.onsuccess = () => {
                        const database = request.result;
                        database.onversionchange = () => database.close();
                        resolve(database);
                    };
                    request.onerror = () => reject(request.error || new Error('Não foi possível abrir o armazenamento offline.'));
                    request.onblocked = () => reject(new Error('O armazenamento offline está ocupado noutra janela.'));
                }).catch(error => {
                    offlineDatabasePromise = null;
                    throw error;
                });
            }
            return offlineDatabasePromise;
        }

        async function saveOfflineSnapshot() {
            if (!currentUser) return;
            const database = await openOfflineDatabase();
            const snapshot = {
                userId: currentUser.id,
                savedAt: new Date().toISOString(),
                userRole,
                currentTeamMemberId,
                currentTeamManagerId,
                currentTeamMemberPreferences,
                allProperties: allPropertiesCache,
                allTasks: allTasksCache,
                teamMembers: allTeamMembersCache,
                propertyCleaners
            };
            await new Promise((resolve, reject) => {
                const transaction = database.transaction('snapshots', 'readwrite');
                transaction.objectStore('snapshots').put(snapshot);
                transaction.oncomplete = resolve;
                transaction.onerror = () => reject(transaction.error || new Error('Não foi possível guardar a cópia offline.'));
                transaction.onabort = () => reject(transaction.error || new Error('Não foi possível guardar a cópia offline.'));
            });
        }

        async function restoreOfflineSnapshot() {
            if (!currentUser) return false;
            const database = await openOfflineDatabase();
            const snapshot = await new Promise((resolve, reject) => {
                const transaction = database.transaction('snapshots', 'readonly');
                const request = transaction.objectStore('snapshots').get(currentUser.id);
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => reject(request.error || new Error('Não foi possível ler a cópia offline.'));
            });
            if (!snapshot) return false;

            userRole = snapshot.userRole === 'admin' ? 'admin' : 'cleaner';
            currentTeamMemberId = snapshot.currentTeamMemberId || null;
            currentTeamManagerId = snapshot.currentTeamManagerId || null;
            currentTeamMemberPreferences = snapshot.currentTeamMemberPreferences || { track_hours: false, require_photos: false };
            allPropertiesCache = snapshot.allProperties || [];
            allTasksCache = snapshot.allTasks || [];
            allTeamMembersCache = snapshot.teamMembers || [];
            propertyCleaners = snapshot.propertyCleaners || [];
            const pending = (await listPendingOfflineItems()).filter(item => item.userId === currentUser.id);
            pending.forEach(item => {
                if (item.type === 'task_start') {
                    updateTaskLocalState(item.taskId, {
                        started_at: item.startedAt,
                        status: 'in_progress'
                    });
                } else if (item.type === 'task_completion') {
                    updateTaskLocalState(item.taskId, {
                        started_at: item.startedAt,
                        completed_at: item.completedAt,
                        total_duration_minutes: item.totalDurationMinutes,
                        checklist_state: item.checklistState || {},
                        status: 'completed'
                    });
                }
            });
            const { start, end } = getAgendaDateRange();
            agendaTasksCache = allTasksCache.filter(task =>
                task.scheduled_date >= start && task.scheduled_date <= end
            );
            renderAgendaSummary();
            renderAgendaView();
            if (userRole === 'admin') await carregarAlertasIncidentes();
            return true;
        }

        async function listPendingOfflineItems() {
            const database = await openOfflineDatabase();
            return new Promise((resolve, reject) => {
                const transaction = database.transaction('pending', 'readonly');
                const request = transaction.objectStore('pending').getAll();
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(request.error || new Error('Não foi possível ler a fila offline.'));
                transaction.onabort = () => reject(transaction.error || new Error('Não foi possível ler a fila offline.'));
            });
        }

        async function savePendingOfflineItem(item) {
            const database = await openOfflineDatabase();
            if (navigator.storage?.persist) {
                try {
                    await navigator.storage.persist();
                } catch (error) {
                    console.warn('O navegador não confirmou o armazenamento persistente:', error);
                }
            }
            const record = {
                ...item,
                id: item.id || crypto.randomUUID(),
                userId: currentUser?.id,
                createdAt: Date.now()
            };
            if (!record.userId) throw new Error('Inicie sessão antes de guardar dados offline.');

            const saved = await new Promise((resolve, reject) => {
                const transaction = database.transaction('pending', 'readwrite');
                const request = transaction.objectStore('pending').add(record);
                let sequence;
                request.onsuccess = () => { sequence = Number(request.result); };
                request.onerror = () => reject(request.error || new Error('Não foi possível guardar o item offline.'));
                transaction.oncomplete = () => resolve({ ...record, sequence });
                transaction.onabort = () => reject(transaction.error || new Error('Não foi possível guardar o item offline.'));
            });
            if (saved?.type === 'incident') {
                await refreshUrgentIncidentBadge();
            }
            await updateOfflineIndicator();
            void requestBackgroundSync();
            if (navigator.onLine && currentUser) {
                isOfflineMode = false;
                void syncPendingData();
            }
            return saved;
        }

        async function deletePendingOfflineItem(sequence) {
            const database = await openOfflineDatabase();
            await new Promise((resolve, reject) => {
                const transaction = database.transaction('pending', 'readwrite');
                transaction.objectStore('pending').delete(sequence);
                transaction.oncomplete = resolve;
                transaction.onerror = () => reject(transaction.error || new Error('Não foi possível atualizar a fila offline.'));
                transaction.onabort = () => reject(transaction.error || new Error('Não foi possível atualizar a fila offline.'));
            });
        }

        async function updatePendingOfflineItem(item) {
            const database = await openOfflineDatabase();
            await new Promise((resolve, reject) => {
                const transaction = database.transaction('pending', 'readwrite');
                transaction.objectStore('pending').put(item);
                transaction.oncomplete = resolve;
                transaction.onerror = () => reject(transaction.error || new Error('Não foi possível atualizar a fila offline.'));
                transaction.onabort = () => reject(transaction.error || new Error('Não foi possível atualizar a fila offline.'));
            });
        }

        async function queueTaskNotesForSync(taskId, cleanerNotes) {
            const pending = await listPendingOfflineItems();
            const existing = pending.find(item =>
                item.type === 'task_notes'
                && item.userId === currentUser.id
                && String(item.taskId) === String(taskId)
            );
            if (existing) {
                existing.cleanerNotes = cleanerNotes;
                await updatePendingOfflineItem(existing);
                return existing;
            }
            return savePendingOfflineItem({ type: 'task_notes', taskId, cleanerNotes });
        }

        function offlineLabel(key, count) {
            return i18n[currentLang][key].replace('{count}', String(count));
        }

        async function updateOfflineIndicator(messageOverride = null) {
            const indicator = document.getElementById('offline-sync-indicator');
            const message = document.getElementById('offline-sync-message');
            if (!indicator || !message) return;
            try {
                const pending = await listPendingOfflineItems();
                const offline = isOfflineMode || !navigator.onLine;
                if (!offline && pending.length === 0 && !messageOverride) {
                    indicator.classList.add('hidden');
                    return;
                }
                indicator.classList.remove('hidden');
                message.innerText = messageOverride || (offline
                    ? offlineLabel('offline_status', pending.length)
                    : offlineLabel('offline_pending_status', pending.length));
            } catch (error) {
                console.error('Erro ao atualizar o indicador offline:', error);
                indicator.classList.remove('hidden');
                message.innerText = `${i18n[currentLang].offline_storage_error}: ${error.message}`;
            }
        }

        async function requestBackgroundSync() {
            if (!('serviceWorker' in navigator)) return;
            try {
                const registration = await navigator.serviceWorker.ready;
                if (registration.sync) await registration.sync.register('host-cleaner-sync');
            } catch (error) {
                console.warn('Não foi possível agendar a sincronização em segundo plano:', error);
            }
        }

        async function uploadQueuedTaskPhoto(item) {
            const uploadFile = typeof item.file === 'string' ? dataURLtoBlob(item.file) : item.file;
            const storage = supabaseClient.storage.from('cleaning-photos');
            const { error: uploadError } = await storage.upload(item.storagePath, uploadFile, {
                contentType: uploadFile?.type || 'application/octet-stream',
                upsert: true
            });
            if (uploadError) throw uploadError;

            const photoUrl = storage.getPublicUrl(item.storagePath).data.publicUrl;
            const { error: photoError } = await supabaseClient
                .from('cleaning_task_photos')
                .insert([{
                    property_id: item.propertyId,
                    task_id: item.taskId,
                    uploaded_by: item.userId,
                    photo_url: photoUrl,
                    storage_path: item.storagePath
                }]);
            if (photoError && !/duplicate|already exists|already.*processed|23505|42P10/i.test(String(photoError.message || photoError.details || photoError.code || ''))) {
                throw photoError;
            }
            if (item.photoField) {
                const { error: taskError } = await supabaseClient
                    .from('cleaning_tasks')
                    .update({ [item.photoField]: photoUrl })
                    .eq('id', item.taskId);
                if (taskError) throw taskError;
            }
        }

        async function syncPendingOfflineItem(item) {
            if (item.type === 'task_photo') {
                await uploadQueuedTaskPhoto(item);
                return;
            }
            if (item.type === 'task_notes') {
                const { error } = await supabaseClient
                    .from('cleaning_tasks')
                    .update({ cleaner_notes: item.cleanerNotes })
                    .eq('id', item.taskId);
                if (error) throw error;
                return;
            }
            if (item.type === 'task_start') {
                const { error } = await supabaseClient.rpc('sync_cleaning_task_start', {
                    p_task_id: item.taskId,
                    p_started_at: item.startedAt
                });
                if (error) throw error;
                return;
            }
            if (item.type === 'task_completion') {
                const { error } = await supabaseClient.rpc('sync_cleaning_task_completion', {
                    p_task_id: item.taskId,
                    p_started_at: item.startedAt,
                    p_completed_at: item.completedAt,
                    p_total_duration_minutes: item.totalDurationMinutes,
                    p_checklist_state: item.checklistState || {}
                });
                if (error) throw error;
                return;
            }
            if (item.type === 'incident') {
                const legacyItemFile = typeof item.file === 'string' ? dataURLtoBlob(item.file) : item.file;
                const legacyExtension = legacyItemFile ? getIncidentPhotoExtension(legacyItemFile) : null;
                if (legacyItemFile && !legacyExtension) throw new Error(i18n[currentLang].incident_photo_error);
                const files = (item.files || (legacyItemFile ? [{
                    file: legacyItemFile,
                    storagePath: `${item.userId}/${item.propertyId}/${item.incidentId}/${item.incidentId}.${legacyExtension}`
                }] : [])).map(photo => ({
                    ...photo,
                    file: typeof photo.file === 'string' ? dataURLtoBlob(photo.file) : photo.file
                }));
                const storage = supabaseClient.storage.from('property-incidents');
                const photoUrls = [];
                for (const photo of files) {
                    if (!photo.file || !photo.storagePath) continue;
                    try {
                        const { error: uploadError } = await storage.upload(photo.storagePath, photo.file, {
                            contentType: photo.file.type || 'application/octet-stream',
                            upsert: true
                        });
                        if (uploadError) throw uploadError;
                    } catch (error) {
                        console.error('Falha ao enviar fotografia de incidente para o Storage:', {
                            message: error?.message || String(error),
                            name: error?.name,
                            statusCode: error?.statusCode,
                            error: error?.error,
                            bucket: 'property-incidents',
                            path: photo.storagePath,
                            incidentId: item.incidentId,
                            sequence: item.sequence
                        });
                        throw error;
                    }
                    photoUrls.push(storage.getPublicUrl(photo.storagePath).data.publicUrl);
                }
                const insertPayload = {
                    property_id: item.propertyId,
                    type: item.incidentType,
                    priority: item.priority || (item.isPriority ? 'urgent' : 'normal'),
                    description: item.description,
                    photos: photoUrls,
                    photo_url: photoUrls[0] || null,
                    created_by: item.userId,
                    created_at: item.createdAtISO,
                    status: 'pending'
                };
                const { error } = await supabaseClient
                    .from('property_incidents')
                    .insert([insertPayload]);
                if (error && !/duplicate|already exists|already.*processed|23505|42P10/i.test(String(error.message || error.details || error.code || ''))) {
                    throw error;
                }
                return;
            }
            throw new Error(`Tipo de sincronização desconhecido: ${item.type}`);
        }

        async function syncPendingData() {
            if (syncPendingPromise) return syncPendingPromise;
            if (!navigator.onLine || !currentUser) {
                await updateOfflineIndicator();
                return false;
            }

            isOfflineMode = false;
            syncPendingPromise = (async () => {
                try {
                    const allPending = await listPendingOfflineItems();
                    const pending = allPending.filter(item => item.userId === currentUser.id);
                    for (const item of pending) {
                        if (!navigator.onLine || !currentUser || item.userId !== currentUser.id) break;
                        try {
                            await syncPendingOfflineItem(item);
                            await deletePendingOfflineItem(item.sequence);
                            await updateOfflineIndicator();
                        } catch (error) {
                            const errorText = String(error?.message || error?.details || error || '');
                            const alreadyProcessed = /duplicate|already exists|already.*processed|23505|42P10/i.test(errorText);
                            if (alreadyProcessed) {
                                await deletePendingOfflineItem(item.sequence).catch(() => undefined);
                                await updateOfflineIndicator();
                                continue;
                            }
                            console.error('Falha ao sincronizar item offline; o item permanece na fila:', {
                                message: error?.message || String(error),
                                name: error?.name,
                                type: item.type,
                                sequence: item.sequence,
                                incidentId: item.incidentId,
                                propertyId: item.propertyId
                            });
                            throw error;
                        }
                    }
                    const remaining = await listPendingOfflineItems();
                    const ownPending = remaining.some(item => item.userId === currentUser.id);
                    const otherAccountPending = remaining.some(item => item.userId !== currentUser.id);
                    if (!ownPending && otherAccountPending) {
                        await updateOfflineIndicator(i18n[currentLang].offline_sync_account);
                    } else {
                        await updateOfflineIndicator();
                    }
                    if (ownPending && navigator.onLine) {
                        schedulePendingSyncRetry();
                    } else {
                        clearPendingSyncRetry();
                    }
                    if (document.getElementById('view-sub-agenda') && !document.getElementById('view-sub-agenda').classList.contains('hidden')) {
                        await loadData();
                    }
                    await refreshUrgentIncidentBadge();
                    if (userRole === 'admin' && !document.getElementById('view-sub-financial-entries').classList.contains('hidden')) {
                        await fetchHistoryAdmin();
                    }
                    if (userRole === 'admin' && ['view-sub-reports', 'view-sub-financial-entries'].some(id =>
                        !document.getElementById(id).classList.contains('hidden'))) {
                        await carregarRelatorios();
                    }
                    if (userRole === 'admin' && !document.getElementById('view-sub-financial-entries').classList.contains('hidden')) {
                        await carregarLancamentosManuais();
                    }
                    if (userRole === 'admin' && !document.getElementById('view-sub-hosting-reports').classList.contains('hidden')) {
                        await carregarDocumentosHosting();
                    }
                    return !ownPending;
                } catch (error) {
                    console.error('Erro ao sincronizar dados offline:', error);
                    if (isOfflineNetworkError(error)) isOfflineMode = true;
                    await updateOfflineIndicator(i18n[currentLang].offline_sync_error);
                    if (navigator.onLine && currentUser) schedulePendingSyncRetry();
                    return false;
                } finally {
                    syncPendingPromise = null;
                }
            })();
            return syncPendingPromise;
        }

        function clearPendingSyncRetry() {
            if (syncRetryTimer) window.clearTimeout(syncRetryTimer);
            syncRetryTimer = null;
            syncRetryAttempt = 0;
        }

        function schedulePendingSyncRetry() {
            if (syncRetryTimer || !navigator.onLine || !currentUser) return;
            const delay = Math.min(30000, 1000 * (2 ** Math.min(syncRetryAttempt, 5)));
            syncRetryAttempt += 1;
            syncRetryTimer = window.setTimeout(() => {
                syncRetryTimer = null;
                if (!navigator.onLine || !currentUser) return;
                isOfflineMode = false;
                void syncPendingData();
            }, delay);
        }

        async function resumePendingSync() {
            if (!navigator.onLine) {
                isOfflineMode = true;
                await updateOfflineIndicator();
                return;
            }
            isOfflineMode = false;
            clearPendingSyncRetry();
            await syncPendingData();
        }

        async function forcePendingSync() {
            if (!navigator.onLine || !currentUser) {
                await updateOfflineIndicator();
                return false;
            }
            if (syncPendingPromise) await syncPendingPromise;
            clearPendingSyncRetry();
            return syncPendingData();
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

            if (!navigator.onLine) {
                propertyCleaners = allTeamMembersCache.filter(member => member.role === 'cleaner');
                select.replaceChildren(new Option(i18n[currentLang].option_no_cleaner, ''));
                propertyCleaners.forEach(cleaner => {
                    select.add(new Option(cleaner.name || cleaner.email || 'Cleaner', cleaner.id));
                });
                select.disabled = false;
                return;
            }

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

        function getPropertyOperationalStatus(property) {
            const tasks = (allTasksCache || []).filter(task => String(task.property_id) === String(property.id));
            if (!tasks.length) return { label: 'Disponível', tone: 'slate', count: 0 };
            const currentMonth = new Date();
            const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
            const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59, 999);
            const currentMonthTasks = tasks.filter(task => {
                const taskDate = new Date(task.scheduled_date || task.completed_at || task.created_at || new Date());
                return !Number.isNaN(taskDate.getTime()) && taskDate >= monthStart && taskDate <= monthEnd;
            });
            if (currentMonthTasks.some(task => isTaskInProgress(task))) return { label: 'Em Limpeza', tone: 'amber', count: currentMonthTasks.filter(task => isTaskCompleted(task)).length };
            if (currentMonthTasks.some(task => isTaskPending(task))) return { label: 'Pendente', tone: 'slate', count: currentMonthTasks.filter(task => isTaskCompleted(task)).length };
            if (currentMonthTasks.some(task => isTaskCompleted(task))) return { label: 'Pronta', tone: 'emerald', count: currentMonthTasks.filter(task => isTaskCompleted(task)).length };
            return { label: 'Disponível', tone: 'slate', count: currentMonthTasks.filter(task => isTaskCompleted(task)).length };
        }

        function openPropertyQuickModal(property) {
            const modal = document.getElementById('property-quick-modal');
            const body = document.getElementById('property-quick-modal-body');
            const title = document.getElementById('property-quick-modal-title');
            if (!modal || !body || !title || !property) return;

            const assignedCleaner = propertyCleaners.find(cleaner => String(cleaner.id) === String(property.assigned_team_member_id));
            const cleanerName = assignedCleaner?.name || assignedCleaner?.email || 'Sem atribuição';
            const status = getPropertyOperationalStatus(property);
            const monthCleanings = (allTasksCache || []).filter(task =>
                String(task.property_id) === String(property.id) &&
                isTaskCompleted(task) &&
                (() => {
                    const taskDate = new Date(task.scheduled_date || task.completed_at || task.created_at || new Date());
                    const now = new Date();
                    return taskDate.getFullYear() === now.getFullYear() && taskDate.getMonth() === now.getMonth();
                })()
            ).length;

            title.textContent = property.name || 'Alojamento';
            body.innerHTML = `
                <div class="space-y-4">
                    <div class="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Resumo</p>
                        <div class="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                            <div class="rounded-xl border border-slate-200 bg-white p-2">
                                <p class="text-slate-500">Estado</p>
                                <p class="mt-1 font-bold ${status.tone === 'emerald' ? 'text-emerald-700' : status.tone === 'amber' ? 'text-amber-700' : 'text-slate-700'}">${status.label}</p>
                            </div>
                            <div class="rounded-xl border border-slate-200 bg-white p-2">
                                <p class="text-slate-500">Limpezas</p>
                                <p class="mt-1 font-black text-slate-900">${monthCleanings}</p>
                            </div>
                            <div class="rounded-xl border border-slate-200 bg-white p-2 col-span-2">
                                <p class="text-slate-500">Atribuição</p>
                                <p class="mt-1 font-bold text-slate-800">${escapePropertyHTML(cleanerName)}</p>
                            </div>
                        </div>
                    </div>

                    <div class="space-y-2 text-[11px] text-slate-600">
                        <p><span class="font-bold text-slate-700">Morada:</span> ${escapePropertyHTML(property.address || 'Sem morada')}</p>
                        <p><span class="font-bold text-slate-700">Keybox:</span> ${escapePropertyHTML(property.access_code || 'N/A')}</p>
                        <p><span class="font-bold text-slate-700">Taxa:</span> ${escapePropertyHTML(property.hourly_rate || 10.00)}€/h</p>
                        ${property.instructions ? `<p><span class="font-bold text-slate-700">Instruções:</span> ${escapePropertyHTML(property.instructions)}</p>` : ''}
                    </div>

                    <div class="flex gap-2 pt-2">
                        ${userRole === 'admin' ? `<button type="button" data-property-edit-id="${escapePropertyHTML(String(property.id))}" class="property-edit-modal-btn flex-1 rounded-xl bg-indigo-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-indigo-700">Editar</button>` : ''}
                        <button type="button" onclick="closePropertyQuickModal()" class="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50">Fechar</button>
                    </div>
                </div>
            `;

            body.querySelector('.property-edit-modal-btn')?.addEventListener('click', () => {
                const propertyToEdit = allPropertiesCache.find(item => String(item.id) === String(property.id));
                if (propertyToEdit) loadPropertyForEdit(propertyToEdit);
                closePropertyQuickModal();
            });

            modal.classList.remove('hidden');
            modal.classList.add('flex');
            document.body.classList.add('overflow-hidden');
        }

        function closePropertyQuickModal() {
            const modal = document.getElementById('property-quick-modal');
            if (!modal) return;
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            document.body.classList.remove('overflow-hidden');
        }

        async function carregarPropriedades() {
            const gridEl = document.getElementById('properties-grid');
            if (!gridEl) return;
            propertyHistoryPreviewUrls.forEach(urls => urls.forEach(url => URL.revokeObjectURL(url)));
            propertyHistoryPreviewUrls.clear();

            let data = allPropertiesCache;
            let error = null;
            if (navigator.onLine) {
                gridEl.innerHTML = `<p class="text-slate-400 text-xs">${i18n[currentLang].loading_properties}</p>`;
                const result = await supabaseClient.from('properties').select('*').order('created_at', { ascending: false });
                data = result.data;
                error = result.error;
                if (!error) allPropertiesCache = data || [];
            }

            if (error) {
                console.error('Erro ao carregar alojamentos:', error);
                gridEl.innerHTML = `
                    <div class="rounded-2xl border border-rose-200 bg-rose-50 p-4" role="alert">
                        <p class="text-rose-700 text-xs">${i18n[currentLang].error_properties}: ${escapePropertyHTML(error.message)}</p>
                        <button type="button" onclick="carregarPropriedades()" class="mt-2 text-xs font-bold text-rose-700 underline">${i18n[currentLang].retry}</button>
                    </div>
                `;
                return;
            }

            if (!data || data.length === 0) {
                gridEl.innerHTML = `
                    <div class="rounded-2xl border border-dashed border-slate-300 p-6 text-center">
                        <p class="text-slate-500 text-xs">${i18n[currentLang].empty_properties}</p>
                        ${userRole === 'admin' ? `<button type="button" onclick="abrirFormularioPropriedade()" class="mt-3 rounded-xl bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100">${i18n[currentLang].btn_add_property_new}</button>` : ''}
                    </div>
                `;
                return;
            }

            gridEl.innerHTML = data.map(prop => `
                <article class="rounded-2xl border border-slate-200 bg-slate-50 p-2.5 shadow-sm transition hover:border-indigo-300 hover:bg-white">
                    <button type="button" data-property-id="${escapePropertyHTML(prop.id)}" class="property-row-button block w-full rounded-xl text-left">
                        <div class="flex items-start gap-2">
                            <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-[10px] font-black text-indigo-700">${escapePropertyHTML((prop.name || 'P').slice(0, 2).toUpperCase())}</div>
                            <div class="min-w-0 flex-1">
                                <h4 class="truncate text-[12px] font-bold text-slate-900">${escapePropertyHTML(prop.name)}</h4>
                                <p class="mt-0.5 truncate text-[10px] text-slate-500">${escapePropertyHTML(prop.address || 'Sem morada')}</p>
                            </div>
                        </div>
                    </button>

                    <div class="mt-2 flex gap-1.5">
                        <button type="button" data-property-id="${escapePropertyHTML(prop.id)}" class="property-view-button flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-bold text-slate-700 hover:border-indigo-300 hover:text-indigo-600">
                            Detalhes
                        </button>
                        ${userRole === 'admin' ? `
                            <button type="button" data-property-id="${escapePropertyHTML(prop.id)}" title="Editar" aria-label="Editar ${escapePropertyHTML(prop.name)}" class="edit-property-button flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-bold text-slate-700 hover:border-indigo-300 hover:text-indigo-600">
                                Editar
                            </button>
                        ` : ''}
                    </div>
                </article>
            `).join('');

            const modal = document.getElementById('property-quick-modal');
            if (modal && !modal.dataset.bound) {
                modal.dataset.bound = 'true';
                modal.addEventListener('click', event => {
                    if (event.target === modal) closePropertyQuickModal();
                });
                document.addEventListener('keydown', event => {
                    if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
                        closePropertyQuickModal();
                    }
                });
            }

            gridEl.querySelectorAll('.property-row-button, .property-view-button').forEach(button => {
                button.addEventListener('click', () => {
                    const property = data.find(item => String(item.id) === button.dataset.propertyId);
                    if (property) openPropertyQuickModal(property);
                });
            });

            gridEl.querySelectorAll('.edit-property-button').forEach(button => {
                button.addEventListener('click', event => {
                    event.stopPropagation();
                    const property = data.find(item => String(item.id) === button.dataset.propertyId);
                    if (property) loadPropertyForEdit(property);
                });
            });
        }

        function propertyHistoryPriorityLabel(priority) {
            const labels = {
                urgent: i18n[currentLang].property_history_priority_urgent,
                normal: i18n[currentLang].property_history_priority_normal,
                low: i18n[currentLang].property_history_priority_low
            };
            return labels[priority] || labels.normal;
        }

        function safeIncidentPhotoUrl(value) {
            if (typeof value !== 'string') return null;
            try {
                const url = new URL(value, window.location.href);
                return ['https:', 'http:', 'blob:'].includes(url.protocol) ? url.href : null;
            } catch {
                return null;
            }
        }

        async function loadPropertyIncidentHistory(details) {
            const propertyId = details.dataset.propertyId;
            const list = details.querySelector('.property-incident-history-list');
            if (!propertyId || !list) return;

            const previousUrls = propertyHistoryPreviewUrls.get(propertyId) || [];
            previousUrls.forEach(url => URL.revokeObjectURL(url));
            propertyHistoryPreviewUrls.delete(propertyId);
            list.innerHTML = `<p class="text-[10px] text-slate-400">${i18n[currentLang].property_history_loading}</p>`;

            try {
                let incidents = [];
                if (navigator.onLine) {
                    const { data, error } = await supabaseClient
                        .from('property_incidents')
                        .select('id, property_id, type, priority, description, photos, created_by, created_at, status')
                        .eq('property_id', propertyId)
                        .order('created_at', { ascending: false });
                    if (error) throw error;
                    incidents = data || [];
                }

                const pending = (await listPendingOfflineItems()).filter(item =>
                    item.type === 'incident'
                    && item.userId === currentUser?.id
                    && String(item.propertyId) === String(propertyId)
                );
                const savedIds = new Set(incidents.map(item => String(item.id)));
                const queuedIncidents = pending
                    .filter(item => !savedIds.has(String(item.incidentId)))
                    .map(item => {
                        const photos = (item.files || (item.file ? [{ file: item.file }] : []))
                            .filter(photo => photo.file)
                            .map(photo => URL.createObjectURL(photo.file));
                        return {
                            id: item.incidentId,
                            type: item.incidentType,
                            priority: item.priority || (item.isPriority ? 'urgent' : 'normal'),
                            description: item.description,
                            photos,
                            created_by: item.userId,
                            created_at: item.createdAtISO,
                            status: 'pending',
                            queued: true
                        };
                    });
                const previewUrls = queuedIncidents.flatMap(item => item.photos);
                if (previewUrls.length) propertyHistoryPreviewUrls.set(propertyId, previewUrls);
                incidents = [...incidents, ...queuedIncidents]
                    .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)));

                const authors = new Map();
                if (currentUser?.id) {
                    authors.set(String(currentUser.id), currentUser.user_metadata?.full_name
                        || currentUser.user_metadata?.name
                        || currentUser.email
                        || i18n[currentLang].property_history_unknown_author);
                }
                const authorIds = [...new Set(incidents
                    .map(item => item.created_by)
                    .filter(id => id && !authors.has(String(id))))];
                if (authorIds.length) {
                    const { data: members, error } = await supabaseClient
                        .from('team_members')
                        .select('auth_user_id, name, email')
                        .in('auth_user_id', authorIds);
                    if (error) {
                        console.error('Erro ao carregar autores do histórico da propriedade:', error);
                    } else {
                        (members || []).forEach(member => {
                            if (member.auth_user_id) {
                                authors.set(String(member.auth_user_id), member.name || member.email);
                            }
                        });
                    }
                }

                if (!incidents.length) {
                    list.innerHTML = `<p class="rounded-xl border border-dashed border-slate-200 px-3 py-5 text-center text-[10px] text-slate-500">${navigator.onLine ? i18n[currentLang].property_history_empty : i18n[currentLang].property_history_offline}</p>`;
                    if (navigator.onLine) details.dataset.loaded = 'true';
                    return;
                }

                list.innerHTML = incidents.map(incident => {
                    const priority = ['urgent', 'normal', 'low'].includes(incident.priority)
                        ? incident.priority
                        : 'normal';
                    const priorityClasses = {
                        urgent: 'border-rose-200 bg-rose-50 text-rose-700',
                        normal: 'border-indigo-200 bg-indigo-50 text-indigo-700',
                        low: 'border-slate-200 bg-slate-100 text-slate-600'
                    };
                    const author = authors.get(String(incident.created_by))
                        || (incident.created_by
                            ? `${i18n[currentLang].property_history_unknown_author} · ${String(incident.created_by).slice(0, 8)}`
                            : i18n[currentLang].property_history_unknown_author);
                    const date = incident.created_at
                        ? new Date(incident.created_at).toLocaleString(currentLang === 'pt' ? 'pt-PT' : 'en-GB')
                        : '';
                    const photos = Array.isArray(incident.photos)
                        ? incident.photos.map(safeIncidentPhotoUrl).filter(Boolean)
                        : [];
                    return `
                        <article class="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
                            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2.5">
                                <span class="text-[10px] font-semibold text-slate-500">${escapePropertyHTML(date)}</span>
                                <span class="rounded-full border px-2.5 py-1 text-[9px] font-extrabold ${priorityClasses[priority]}">${propertyHistoryPriorityLabel(priority)}</span>
                            </div>
                            <div class="space-y-2.5 p-3">
                                <div class="flex flex-wrap items-center gap-1.5 text-[10px]">
                                    <span class="font-bold text-slate-500">${i18n[currentLang].property_history_author}</span>
                                    <span class="font-semibold text-slate-700">${escapePropertyHTML(author)}</span>
                                    <span class="rounded-full bg-slate-200 px-2 py-0.5 font-bold text-slate-600">${getIncidentTypeLabel(incident.type)}</span>
                                    ${incident.queued ? `<span class="rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-800">${i18n[currentLang].property_history_pending}</span>` : incident.status === 'resolved' ? `<span class="rounded-full bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800">${i18n[currentLang].property_history_resolved}</span>` : ''}
                                </div>
                                <p class="whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-700">${escapePropertyHTML(incident.description)}</p>
                                ${photos.length ? `<div class="grid grid-cols-3 gap-2 sm:grid-cols-4">${photos.map(photoUrl => `<a href="${escapePropertyHTML(photoUrl)}" target="_blank" rel="noopener noreferrer" class="block aspect-square overflow-hidden rounded-xl border border-slate-200 bg-white"><img src="${escapePropertyHTML(photoUrl)}" alt="" loading="lazy" class="h-full w-full object-cover transition hover:scale-105"></a>`).join('')}</div>` : ''}
                            </div>
                        </article>
                    `;
                }).join('');
                details.dataset.loaded = 'true';
            } catch (error) {
                console.error('Erro ao carregar histórico da propriedade:', error);
                list.innerHTML = `
                    <div class="rounded-xl border border-rose-200 bg-rose-50 p-3" role="alert">
                        <p class="text-[10px] font-semibold text-rose-700">${i18n[currentLang].property_history_error}: ${escapePropertyHTML(error.message)}</p>
                        <button type="button" class="property-incident-history-retry mt-2 text-[10px] font-bold text-rose-700 underline">${i18n[currentLang].property_history_retry}</button>
                    </div>
                `;
                list.querySelector('.property-incident-history-retry').addEventListener('click', () => {
                    delete details.dataset.loaded;
                    void loadPropertyIncidentHistory(details);
                });
            }
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

        async function abrirFormularioPropriedade() {
            if (!requireAdminAction()) return;
            if (!(await checkSubscriptionLimit('properties'))) return;
            resetPropertyForm();
            switchTab('sub-properties-add', true);
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
                String(todayTasks.filter(task => isTaskCompleted(task)).length);
            document.getElementById('agenda-today-pending').innerText =
                String(todayTasks.filter(task => isTaskPending(task)).length);
        }

        function setUrgentIncidentBadge(count) {
            const navHistoryButton = document.getElementById('nav-history');
            if (!navHistoryButton) return;
            let badge = navHistoryButton.querySelector('.urgent-badge');
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'urgent-badge hidden ml-auto min-w-5 h-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white';
                navHistoryButton.appendChild(badge);
            }

            const urgentCount = Number.isFinite(count) ? Math.max(0, Number(count)) : 0;
            if (urgentCount > 0) {
                badge.textContent = urgentCount > 99 ? '99+' : String(urgentCount);
                badge.classList.remove('hidden');
                badge.classList.add('inline-flex');
                badge.setAttribute('aria-label', `${urgentCount} incidentes urgentes`);
            } else {
                badge.textContent = '0';
                badge.classList.add('hidden');
                badge.classList.remove('inline-flex');
                badge.removeAttribute('aria-label');
            }
        }

        async function getUrgentIncidentCount() {
            let total = 0;

            try {
                const { count, error } = await supabaseClient
                    .from('property_incidents')
                    .select('id', { count: 'exact', head: true })
                    .eq('priority', 'urgent');
                if (!error) total += Number(count || 0);
            } catch (error) {
                console.warn('Não foi possível verificar incidentes urgentes na base de dados:', error);
            }

            try {
                const pendingItems = await listPendingOfflineItems();
                total += pendingItems.filter(item =>
                    item?.type === 'incident' &&
                    (currentUser ? item.userId === currentUser.id : true) &&
                    (item.priority === 'urgent' || item.isPriority === true)
                ).length;
            } catch (error) {
                console.warn('Não foi possível verificar incidentes urgentes locais:', error);
            }

            try {
                const queueRaw = localStorage.getItem('host_cleaner_offline_queue');
                if (queueRaw) {
                    const queue = JSON.parse(queueRaw);
                    if (Array.isArray(queue)) {
                        total += queue.filter(item =>
                            item && item.type === 'incident' &&
                            (currentUser ? item.userId === currentUser.id : true) &&
                            (item.priority === 'urgent' || item.isPriority === true)
                        ).length;
                    }
                }
            } catch (error) {
                console.warn('Não foi possível verificar incidentes urgentes guardados em localStorage:', error);
            }

            return total;
        }

        async function refreshUrgentIncidentBadge() {
            const count = await getUrgentIncidentCount();
            setUrgentIncidentBadge(count);
            return count;
        }

        function setGlobalIncidentPriorityFilter(priority) {
            globalIncidentPriorityFilter = priority === 'urgent' ? 'urgent' : 'all';
            const allButton = document.getElementById('history-filter-all');
            const urgentButton = document.getElementById('history-filter-urgent');
            [[allButton, globalIncidentPriorityFilter === 'all'], [urgentButton, globalIncidentPriorityFilter === 'urgent']]
                .forEach(([button, active]) => {
                    if (!button) return;
                    button.setAttribute('aria-pressed', String(active));
                    button.classList.toggle('bg-white', active);
                    button.classList.toggle('text-indigo-700', active);
                    button.classList.toggle('shadow-sm', active);
                    button.classList.toggle('font-bold', active);
                    button.classList.toggle('text-slate-600', !active);
                    button.classList.toggle('font-semibold', !active);
                });
            void loadGlobalIncidentHistory();
        }

        async function refreshGlobalIncidentHistory() {
            await forcePendingSync();
            await loadGlobalIncidentHistory();
        }

        function globalHistoryPriorityLabel(priority) {
            const labels = {
                urgent: i18n[currentLang].history_urgent,
                normal: i18n[currentLang].history_normal,
                low: i18n[currentLang].history_low
            };
            return labels[priority] || labels.normal;
        }

        function getGlobalHistoryPriorityClasses(priority) {
            if (priority === 'urgent') return 'border-rose-200 bg-rose-50 text-rose-700';
            if (priority === 'low') return 'border-slate-200 bg-slate-100 text-slate-600';
            return 'border-indigo-200 bg-indigo-50 text-indigo-700';
        }

        async function loadGlobalIncidentHistory() {
            const list = document.getElementById('history-records-list');
            const count = document.getElementById('history-results-count');
            const propertyFilter = document.getElementById('history-property-filter');
            const dateFilter = document.getElementById('history-date-filter');
            const sortFilter = document.getElementById('history-sort');
            if (!list || !count || !propertyFilter || !dateFilter || !sortFilter) return;

            const requestId = ++globalIncidentHistoryRequestId;
            globalHistoryPreviewUrls.forEach(url => URL.revokeObjectURL(url));
            globalHistoryPreviewUrls = [];
            count.textContent = '';
            list.innerHTML = `<p class="col-span-full text-xs text-slate-400">${i18n[currentLang].history_loading}</p>`;

            try {
                if (!allPropertiesCache.length && navigator.onLine) {
                    const { data: properties, error: propertyError } = await supabaseClient
                        .from('properties')
                        .select('id, name')
                        .order('name');
                    if (propertyError) throw propertyError;
                    allPropertiesCache = properties || [];
                }
                const selectedProperty = propertyFilter.value;
                propertyFilter.replaceChildren(
                    new Option(i18n[currentLang].history_all_properties, 'all'),
                    ...allPropertiesCache.map(property => new Option(property.name || 'Alojamento', String(property.id)))
                );
                propertyFilter.value = allPropertiesCache.some(property => String(property.id) === selectedProperty)
                    ? selectedProperty
                    : 'all';

                const pending = (await listPendingOfflineItems()).filter(item =>
                    item.type === 'incident' && item.userId === currentUser?.id
                );
                let incidents = [];
                if (navigator.onLine) {
                    const pageSize = 500;
                    for (let offset = 0; ; offset += pageSize) {
                        let query = supabaseClient
                            .from('property_incidents')
                            .select('id, property_id, type, priority, description, photos, photo_url, created_at, status, properties!property_incidents_property_id_fkey!inner(name)')
                            .order('created_at', { ascending: sortFilter.value !== 'asc' })
                            .range(offset, offset + pageSize - 1);
                        if (globalIncidentPriorityFilter === 'urgent') query = query.eq('priority', 'urgent');
                        if (propertyFilter.value !== 'all') query = query.eq('property_id', propertyFilter.value);
                        if (dateFilter.value) {
                            const startDate = new Date(`${dateFilter.value}T00:00:00`);
                            const endDate = new Date(startDate);
                            endDate.setDate(endDate.getDate() + 1);
                            query = query
                                .gte('created_at', startDate.toISOString())
                                .lt('created_at', endDate.toISOString());
                        }
                        const { data, error } = await query;
                        if (error) throw error;
                        if (requestId !== globalIncidentHistoryRequestId) return;
                        const page = data || [];
                        incidents.push(...page);
                        if (page.length < pageSize) break;
                    }
                }

                const existingIds = new Set(incidents.map(item => String(item.id)));
                const queuedPreviewUrls = [];
                const queuedIncidents = pending
                    .filter(item => !existingIds.has(String(item.incidentId)))
                    .map(item => {
                        const photos = (item.files || (item.file ? [{ file: item.file }] : []))
                            .filter(photo => photo.file)
                            .map(photo => {
                                const url = URL.createObjectURL(photo.file);
                                queuedPreviewUrls.push(url);
                                return url;
                            });
                        return {
                            id: item.incidentId,
                            property_id: item.propertyId,
                            type: item.incidentType,
                            priority: item.priority || (item.isPriority ? 'urgent' : 'normal'),
                            description: item.description,
                            photos,
                            created_at: item.createdAtISO,
                            status: 'pending',
                            queued: true,
                            properties: {
                                name: allPropertiesCache.find(property =>
                                    String(property.id) === String(item.propertyId)
                                )?.name || 'Alojamento'
                            }
                        };
                    })
                    .filter(item => {
                        if (globalIncidentPriorityFilter === 'urgent' && item.priority !== 'urgent') return false;
                        if (propertyFilter.value !== 'all' && String(item.property_id) !== propertyFilter.value) return false;
                        if (dateFilter.value
                            && (!item.created_at || getLocalDateString(new Date(item.created_at)) !== dateFilter.value)) return false;
                        return true;
                    });
                incidents = [...incidents, ...queuedIncidents]
                    .sort((left, right) => {
                        const difference = new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
                        return sortFilter.value === 'asc' ? difference : -difference;
                    });

                if (requestId !== globalIncidentHistoryRequestId) {
                    queuedPreviewUrls.forEach(url => URL.revokeObjectURL(url));
                    return;
                }
                globalHistoryPreviewUrls = queuedPreviewUrls;

                const resultCount = i18n[currentLang].history_results_count.replace('{count}', String(incidents.length));
                count.textContent = navigator.onLine
                    ? resultCount
                    : `${i18n[currentLang].history_offline} ${resultCount}`;
                if (!incidents.length) {
                    list.innerHTML = `<p class="col-span-full rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-xs text-slate-500">${i18n[currentLang].history_empty}</p>`;
                    return;
                }

                list.innerHTML = incidents.map(incident => {
                    const priority = ['urgent', 'normal', 'low'].includes(incident.priority)
                        ? incident.priority
                        : 'normal';
                    const createdAt = incident.created_at && !Number.isNaN(new Date(incident.created_at).getTime())
                        ? new Date(incident.created_at).toLocaleString(currentLang === 'pt' ? 'pt-PT' : 'en-GB')
                        : '';
                    const photos = Array.isArray(incident.photos)
                        ? incident.photos.map(safeIncidentPhotoUrl).filter(Boolean)
                        : incident.photo_url ? [safeIncidentPhotoUrl(incident.photo_url)].filter(Boolean) : [];
                    const propertyName = incident.properties?.name
                        || allPropertiesCache.find(property => String(property.id) === String(incident.property_id))?.name
                        || 'Alojamento';
                    return `
                        <article class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-indigo-200 hover:shadow-md">
                            <header class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
                                <div class="min-w-0">
                                    <h3 class="truncate text-xs font-extrabold text-slate-900">${escapePropertyHTML(propertyName)}</h3>
                                    <time class="mt-1 block text-[10px] font-medium text-slate-500">${escapePropertyHTML(createdAt)}</time>
                                </div>
                                <div class="flex flex-wrap items-center gap-1.5">
                                    <span class="rounded-full border px-2.5 py-1 text-[9px] font-extrabold ${getGlobalHistoryPriorityClasses(priority)}">${globalHistoryPriorityLabel(priority)}</span>
                                    <span class="rounded-full bg-slate-200 px-2 py-1 text-[9px] font-bold text-slate-700">${getIncidentTypeLabel(incident.type)}</span>
                                </div>
                            </header>
                            <div class="space-y-3 p-4">
                                <p class="whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-700">${escapePropertyHTML(incident.description)}</p>
                                ${incident.queued || incident.status === 'resolved' ? `<p class="text-[10px] text-slate-500">${incident.queued ? `<span class="rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-800">${i18n[currentLang].history_pending_sync}</span>` : `<span class="rounded-full bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800">${i18n[currentLang].history_resolved}</span>`}</p>` : ''}
                                ${photos.length ? `<div class="grid grid-cols-3 gap-2 sm:grid-cols-4">${photos.map(photoUrl => `<a href="${escapePropertyHTML(photoUrl)}" target="_blank" rel="noopener noreferrer" class="block aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50"><img src="${escapePropertyHTML(photoUrl)}" alt="" loading="lazy" class="h-full w-full object-cover transition hover:scale-105"></a>`).join('')}</div>` : ''}
                            </div>
                        </article>
                    `;
                }).join('');
            } catch (error) {
                if (requestId !== globalIncidentHistoryRequestId) return;
                console.error('Erro ao carregar histórico global de incidentes:', error);
                list.innerHTML = `
                    <div class="col-span-full rounded-2xl border border-rose-200 bg-rose-50 p-4" role="alert">
                        <p class="text-xs font-semibold text-rose-700">${i18n[currentLang].history_error}: ${escapePropertyHTML(error.message)}</p>
                        <button type="button" onclick="refreshGlobalIncidentHistory()" class="mt-2 text-xs font-bold text-rose-700 underline">${i18n[currentLang].history_refresh}</button>
                    </div>
                `;
            }
        }

        async function carregarAlertasIncidentes() {
            const list = document.getElementById('urgent-incidents-list');
            if (!list || userRole !== 'admin') return;
            offlinePendingIncidentUrls.forEach(url => URL.revokeObjectURL(url));
            offlinePendingIncidentUrls = [];
            const requestId = ++incidentRequestId;
            list.innerHTML = `<p class="text-xs text-rose-700">${i18n[currentLang].incident_alerts_loading}</p>`;

            let data = [];
            if (navigator.onLine) {
                const { data: incidents, error } = await supabaseClient
                    .from('property_incidents')
                    .select('id, property_id, type, description, photos, photo_url, priority, created_at, properties!property_incidents_property_id_fkey!inner(name)')
                    .eq('status', 'pending')
                    .order('created_at', { ascending: false });
                if (requestId !== incidentRequestId) return;
                if (error) {
                    console.error('Erro ao carregar incidentes pendentes:', error);
                    list.innerHTML = `<p role="alert" class="text-xs font-semibold text-rose-700">${i18n[currentLang].incident_alerts_error}: ${escapePropertyHTML(error.message)}</p>`;
                    return;
                }
                data = (incidents || []).map(incident => ({
                    ...incident,
                    photo_urls: incident.photos?.length ? incident.photos : incident.photo_url ? [incident.photo_url] : []
                }));
            } else {
                try {
                    const queued = (await listPendingOfflineItems()).filter(item =>
                        item.type === 'incident' && item.userId === currentUser.id
                    );
                    data = queued.map(item => ({
                        id: item.incidentId,
                        property_id: item.propertyId,
                        type: item.incidentType,
                        description: item.description,
                        photos: [],
                        photo_urls: (item.files || (item.file ? [{ file: item.file }] : []))
                            .filter(photo => photo.file)
                            .map(photo => URL.createObjectURL(photo.file)),
                        priority: item.priority || (item.isPriority ? 'urgent' : 'normal'),
                        created_at: item.createdAtISO,
                        properties: {
                            name: allPropertiesCache.find(property =>
                                String(property.id) === String(item.propertyId)
                            )?.name || 'Alojamento'
                        },
                        queued: true
                    }));
                    offlinePendingIncidentUrls = data.flatMap(item => item.photo_urls);
                } catch (error) {
                    console.error('Erro ao carregar incidentes offline:', error);
                    list.innerHTML = `<p role="alert" class="text-xs font-semibold text-rose-700">${i18n[currentLang].incident_alerts_error}: ${escapePropertyHTML(error.message)}</p>`;
                    return;
                }
            }

            if (!data?.length) {
                list.innerHTML = `<p class="text-xs text-rose-700">${i18n[currentLang].incident_alerts_empty}</p>`;
                return;
            }

            list.innerHTML = data.map(incident => `
                <article class="rounded-xl border border-rose-200 bg-white p-2.5 sm:p-3">
                    <div class="incident-alert-mobile flex items-center gap-2">
                        <span class="shrink-0 text-base" title="${incident.priority === 'urgent' ? i18n[currentLang].incident_priority_badge : getIncidentTypeLabel(incident.type)}" aria-label="${incident.priority === 'urgent' ? i18n[currentLang].incident_priority_badge : getIncidentTypeLabel(incident.type)}">${incident.priority === 'urgent' ? '🚨' : incident.type === 'note' ? '📝' : '⚠️'}</span>
                        <p class="min-w-0 flex-1 truncate text-xs font-semibold text-slate-800" title="${escapePropertyHTML(`${incident.properties?.name || 'Alojamento'} · ${getIncidentTypeLabel(incident.type)}: ${incident.description}`)}">
                            ${escapePropertyHTML(incident.properties?.name || 'Alojamento')} · ${getIncidentTypeLabel(incident.type)}: ${escapePropertyHTML(incident.description)}
                        </p>
                        ${incident.photo_urls.length ? `<a href="${escapePropertyHTML(incident.photo_urls[0])}" target="_blank" rel="noopener noreferrer" aria-label="${escapePropertyHTML(i18n[currentLang].incident_photo)}" class="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100">📷 ${incident.photo_urls.length > 1 ? incident.photo_urls.length : ''}</a>` : ''}
                        ${incident.queued ? `<span title="${escapePropertyHTML(i18n[currentLang].offline_photo_pending)}" class="max-w-24 shrink-0 truncate text-right text-[10px] font-semibold text-slate-500">${i18n[currentLang].offline_photo_pending}</span>` : `<button type="button" onclick="resolvePropertyIncident('${escapePropertyHTML(incident.id)}')" class="min-h-10 shrink-0 rounded-lg bg-rose-600 px-2.5 text-[11px] font-bold text-white hover:bg-rose-700">${currentLang === 'pt' ? 'Resolver' : 'Resolve'}</button>`}
                    </div>
                    <div class="incident-alert-desktop flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div class="min-w-0 flex-1">
                            <p class="text-xs font-extrabold text-slate-900">${escapePropertyHTML(incident.properties?.name || 'Alojamento')} · ${getIncidentTypeLabel(incident.type)}</p>
                            <span class="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800">${i18n[currentLang].incident_pending}</span>
                            ${incident.priority === 'urgent' ? `<span class="ml-1 mt-1 inline-flex rounded-full bg-rose-100 px-2 py-1 text-[10px] font-bold text-rose-800">🚨 ${i18n[currentLang].incident_priority_badge}</span>` : ''}
                            <p class="mt-1 whitespace-pre-wrap break-words text-xs text-slate-700">${escapePropertyHTML(incident.description)}</p>
                            <p class="mt-2 text-[10px] text-slate-500">${i18n[currentLang].incident_date}: ${new Date(incident.created_at).toLocaleString(currentLang === 'pt' ? 'pt-PT' : 'en-GB')}</p>
                        </div>
                        ${incident.photo_urls.length ? `<div class="flex shrink-0 flex-wrap gap-2">${incident.photo_urls.map(photoUrl => `<a href="${escapePropertyHTML(photoUrl)}" target="_blank" rel="noopener noreferrer" aria-label="${escapePropertyHTML(i18n[currentLang].incident_photo)}"><img src="${escapePropertyHTML(photoUrl)}" alt="" class="h-20 w-20 rounded-lg border border-slate-200 object-cover"></a>`).join('')}</div>` : ''}
                    </div>
                    ${incident.queued ? '' : `<button type="button" onclick="resolvePropertyIncident('${escapePropertyHTML(incident.id)}')" class="incident-alert-desktop-action mt-3 min-h-11 w-full rounded-xl bg-rose-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-rose-700 sm:w-auto">${i18n[currentLang].incident_resolve}</button>`}
                </article>
            `).join('');
        }

        async function resolvePropertyIncident(incidentId) {
            if (!requireAdminAction()) return;
            const { error } = await supabaseClient
                .from('property_incidents')
                .update({ status: 'resolved' })
                .eq('id', incidentId)
                .eq('status', 'pending');
            if (error) {
                console.error('Erro ao resolver incidente:', error);
                alert(`${i18n[currentLang].incident_resolve_error}: ${error.message}`);
                return;
            }
            await refreshTaskAndIncidentViews();
        }

        async function fetchAgendaTasks() {
            const listContainer = document.getElementById('tasks-list-container');
            const calendarContainer = document.getElementById('calendar-grid-container');
            if (!listContainer || !calendarContainer) return;
            if (!navigator.onLine) {
                const { start, end } = getAgendaDateRange();
                agendaTasksCache = allTasksCache.filter(task =>
                    task.scheduled_date >= start
                    && task.scheduled_date <= end
                    && (selectedPropertyFilter === 'all' || String(task.property_id) === String(selectedPropertyFilter))
                );
                renderAgendaSummary();
                renderAgendaView();
                return;
            }
            if (userRole === 'admin') void carregarAlertasIncidentes();
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
                if (isOfflineNetworkError(error)) {
                    isOfflineMode = true;
                    if (await restoreOfflineSnapshot()) {
                        await updateOfflineIndicator();
                        return;
                    }
                }
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
                        <span class="text-[11px] font-bold px-2.5 py-1 rounded-full ${isTaskCompleted(task) ? 'bg-emerald-100 text-emerald-800' : isTaskInProgress(task) ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'}">
                            ${isTaskCompleted(task) ? '🟢 Concluída' : isTaskInProgress(task) ? '🔄 Em Andamento' : '⏳ Pendente'}
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
                await refreshTaskAndIncidentViews();
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
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${isTaskCompleted(task) ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}">
                            ${isTaskCompleted(task) ? '🟢 Concluída' : '⏳ Pendente'}
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
                    label: photo.pending
                        ? i18n[currentLang].offline_photo_pending
                        : new Date(photo.created_at).toLocaleDateString(currentLang === 'pt' ? 'pt-PT' : 'en-US')
                }))
            ];
            return `
                <div class="space-y-3 pt-2 border-t border-slate-100">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span class="block font-bold text-slate-700">📸 ${i18n[currentLang].task_photos_verification}</span>
                        <label for="task-photo-input-${taskId}" class="cursor-pointer rounded-xl bg-indigo-50 px-3 py-2 text-center text-[11px] font-bold text-indigo-700 hover:bg-indigo-100">
                            ${i18n[currentLang].photo_upload}
                        </label>
                        <input id="task-photo-input-${taskId}" type="file" accept="image/*" capture="environment" class="sr-only" onchange="handleTaskPhotoUpload(event, '${taskId}', '${escapePropertyHTML(task.property_id)}')">
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
            `;
        }

        async function openTaskModal(task) {
            offlinePendingPhotoUrls.forEach(url => URL.revokeObjectURL(url));
            offlinePendingPhotoUrls = [];
            document.getElementById('modal-prop-name').innerText = task.properties?.name || 'Detalhes da Limpeza';
            
            const deleteBtn = document.getElementById('btn-delete-task-modal');
            if (userRole === 'admin') {
                deleteBtn.classList.remove('hidden');
                deleteBtn.onclick = () => deleteTask(task.id);
            } else {
                deleteBtn.classList.add('hidden');
            }

            const btnWhatsapp = document.getElementById('btn-whatsapp-notify');
            if (btnWhatsapp) btnWhatsapp.onclick = () => sendWhatsappNotification(task);

            const assignmentControl = document.getElementById('task-assignment-control');
            const assignmentSelect = document.getElementById('task-assigned-member');
            taskTeamMembers = [];
            assignmentSelect.innerHTML = '<option value="">Sem atribuição</option>';
            assignmentControl.classList.toggle('hidden', userRole !== 'admin');

            if (userRole === 'admin') {
                let data = allTeamMembersCache.filter(member => member.role === 'cleaner');
                if (navigator.onLine) {
                    const result = await supabaseClient
                        .from('team_members')
                        .select('id, name, email, role, track_hours, require_photos')
                        .eq('role', 'cleaner')
                        .order('name');
                    if (result.error) {
                        alert('Erro ao carregar membros para atribuir a limpeza: ' + result.error.message);
                        return;
                    }
                    data = result.data || [];
                }
                taskTeamMembers = data;
                taskTeamMembers.forEach(member => {
                    assignmentSelect.add(new Option(member.name || member.email || 'Membro da equipa', member.id));
                });
                assignmentSelect.value = task.assigned_team_member_id || '';
            }

            const taskNotes = document.getElementById('task-notes');
            document.getElementById('task-report-incident').onclick =
                () => openIncidentReportModal(task.property_id);
            taskNotes.value = task.cleaner_notes || '';
            if (userRole === 'admin') {
                try {
                    const queuedNotes = (await listPendingOfflineItems()).find(item =>
                        item.type === 'task_notes'
                        && item.userId === currentUser.id
                        && String(item.taskId) === String(task.id)
                    );
                    if (queuedNotes) taskNotes.value = queuedNotes.cleanerNotes;
                } catch (error) {
                    console.error('Erro ao carregar notas locais pendentes:', error);
                    alert(`${i18n[currentLang].offline_storage_error}: ${error.message}`);
                    return;
                }
            }
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
            if (navigator.onLine) {
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
            } else {
                try {
                    const pendingPhotos = (await listPendingOfflineItems()).filter(item =>
                        item.type === 'task_photo'
                        && item.userId === currentUser.id
                        && String(item.taskId) === String(task.id)
                    );
                    taskPhotos = pendingPhotos
                        .filter(item => item.file instanceof Blob)
                        .map(item => {
                            const photoUrl = URL.createObjectURL(item.file);
                            offlinePendingPhotoUrls.push(photoUrl);
                            return { photo_url: photoUrl, created_at: item.createdAt, pending: true };
                        });
                } catch (error) {
                    console.error('Erro ao carregar fotografias offline pendentes:', error);
                    photoLoadError = error.message;
                }
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

                    <div id="task-time-actions"></div>
                    ${userRole === 'admin' ? `
                        <label for="modal-hours-${escapePropertyHTML(task.id)}" class="block text-xs font-bold text-slate-700">
                            ${i18n[currentLang].task_hours_spent}
                            <input type="number" id="modal-hours-${escapePropertyHTML(task.id)}" min="0.25" max="168" step="0.25" value="${task.hours_spent || ''}" placeholder="ex: 2.5" class="mt-1 w-full border border-slate-200 p-2.5 rounded-xl text-xs bg-white">
                        </label>
                    ` : ''}
                    <div class="space-y-2 pt-2 border-t border-slate-100">
                        <label class="block font-bold text-slate-700">Estado da Tarefa</label>
                        <select id="modal-status-${task.id}" ${userRole !== 'admin' ? 'disabled' : ''} class="w-full border border-slate-200 p-2.5 rounded-xl font-bold bg-white text-xs disabled:bg-slate-100 disabled:text-slate-500">
                            <option value="pending" ${isTaskPending(task) ? 'selected' : ''}>⏳ Pendente</option>
                            <option value="in_progress" ${isTaskInProgress(task) ? 'selected' : ''}>🔄 Em Andamento</option>
                            <option value="completed" ${isTaskCompleted(task) ? 'selected' : ''}>🟢 Concluída</option>
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
            document.getElementById('task-time-actions').innerHTML =
                renderTaskTimeActions(task);
            if (userRole === 'admin') {
                assignmentSelect.onchange = renderPermissionModules;
                assignmentSelect.addEventListener('change', () => {
                    document.getElementById('task-time-actions').innerHTML =
                        renderTaskTimeActions(task);
                });
            }
            document.getElementById('task-modal').classList.remove('hidden');
            document.getElementById('btn-task-manual-sync').dataset.taskId = task.id;
            document.getElementById('task-manual-sync-message').classList.add('hidden');
        }

        function renderTaskTimeActions(task) {
            const isAssignedCleaner = userRole === 'cleaner'
                && currentTeamMemberId
                && String(task.assigned_team_member_id) === String(currentTeamMemberId);
            if (!isAssignedCleaner) return '';

            if (isTaskCompleted(task)) {
                return task.total_duration_minutes
                    ? `<p class="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs font-bold text-emerald-800">${i18n[currentLang].time_duration_total}: ${formatTaskDuration(task.total_duration_minutes)}</p>`
                    : '';
            }

            if (isTaskInProgress(task) && task.started_at) {
                return `
                    <div class="space-y-2 rounded-2xl border border-indigo-100 bg-indigo-50 p-3">
                        <p class="text-[11px] font-semibold text-indigo-800">${i18n[currentLang].time_started_at}: ${new Date(task.started_at).toLocaleTimeString(currentLang === 'pt' ? 'pt-PT' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                        <button type="button" onclick="requestCleaningCompletion('${escapePropertyHTML(task.id)}')" class="min-h-14 w-full rounded-xl bg-emerald-600 px-4 py-4 text-sm font-extrabold text-white shadow-md transition hover:bg-emerald-700">${i18n[currentLang].btn_complete_cleaning}</button>
                    </div>
                `;
            }

            return `<button type="button" onclick="startCleaningTask('${escapePropertyHTML(task.id)}')" class="min-h-14 w-full rounded-xl bg-indigo-600 px-4 py-4 text-sm font-extrabold text-white shadow-md transition hover:bg-indigo-700">${i18n[currentLang].btn_start_cleaning}</button>`;
        }

        function formatTaskDuration(totalMinutes) {
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            return `${hours}h ${String(minutes).padStart(2, '0')}min`;
        }

        async function refreshTaskAndIncidentViews() {
            await loadData();
            if (document.getElementById('tasks-list-container')) {
                await fetchAgendaTasks();
                renderAgendaSummary();
                renderAgendaView();
            }
            if (document.getElementById('history-records-list')) {
                await loadGlobalIncidentHistory();
            }
            if (document.getElementById('urgent-incidents-list') && userRole === 'admin') {
                await carregarAlertasIncidentes();
            }
            await refreshUrgentIncidentBadge();
        }

        async function refreshTaskModal(taskId) {
            await loadData();
            const updatedTask = allTasksCache.find(task => String(task.id) === String(taskId));
            if (updatedTask) await openTaskModal(updatedTask);
        }

        function updateTaskLocalState(taskId, updates) {
            [allTasksCache, agendaTasksCache].forEach(tasks => {
                const task = tasks.find(item => String(item.id) === String(taskId));
                if (task) Object.assign(task, updates);
            });
        }

        async function startCleaningTask(taskId) {
            const task = allTasksCache.find(item => String(item.id) === String(taskId));
            const operationKey = `start:${taskId}`;
            if (!task || activeOfflineTaskOperations.has(operationKey)) return;
            activeOfflineTaskOperations.add(operationKey);
            try {
                if (task.started_at && isTaskInProgress(task)) {
                    throw new Error('Esta limpeza já foi iniciada.');
                }
                const pending = await listPendingOfflineItems();
                const existing = pending.find(item =>
                    item.type === 'task_start'
                    && item.userId === currentUser.id
                    && String(item.taskId) === String(taskId)
                );
                const startedAt = existing?.startedAt || new Date().toISOString();
                const queued = existing || await savePendingOfflineItem({
                    type: 'task_start',
                    taskId,
                    startedAt
                });
                updateTaskLocalState(taskId, { started_at: startedAt, status: 'in_progress' });
                if (navigator.onLine && !isOfflineMode) {
                    await syncPendingData();
                    const remaining = await listPendingOfflineItems();
                    if (remaining.some(item => item.sequence === queued.sequence)) {
                        showPropertyMessage('task-photo-message', i18n[currentLang].offline_sync_error, 'error');
                    } else {
                        await refreshTaskModal(taskId);
                    }
                } else {
                    const taskTimeActions = document.getElementById('task-time-actions');
                    if (taskTimeActions) taskTimeActions.innerHTML = renderTaskTimeActions(task);
                }
            } catch (error) {
                console.error('Erro ao iniciar a limpeza:', error);
                alert(`${i18n[currentLang].time_tracking_start_error}: ${error.message}`);
            } finally {
                activeOfflineTaskOperations.delete(operationKey);
            }
        }

        async function queueCleaningCompletion(task, durationMinutes) {
            const operationKey = `complete:${task.id}`;
            if (activeOfflineTaskOperations.has(operationKey)) {
                throw new Error(i18n[currentLang].offline_sync_error);
            }
            activeOfflineTaskOperations.add(operationKey);
            try {
                if (!task.started_at) throw new Error(i18n[currentLang].time_task_not_started);
                const pending = await listPendingOfflineItems();
                const existing = pending.find(item =>
                    item.type === 'task_completion'
                    && item.userId === currentUser.id
                    && String(item.taskId) === String(task.id)
                );
                const completedAt = existing?.completedAt || new Date().toISOString();
                const elapsedMinutes = Math.max(1, Math.round(
                    (new Date(completedAt).getTime() - new Date(task.started_at).getTime()) / 60000
                ));
                const totalDurationMinutes = existing?.totalDurationMinutes ?? durationMinutes ?? elapsedMinutes;
                if (!Number.isInteger(totalDurationMinutes) || totalDurationMinutes < 1 || totalDurationMinutes > 10080) {
                    throw new Error(i18n[currentLang].time_confirmation_invalid);
                }
                const queued = existing || await savePendingOfflineItem({
                    type: 'task_completion',
                    taskId: task.id,
                    startedAt: task.started_at,
                    completedAt,
                    totalDurationMinutes,
                    checklistState: task.checklist_state || {}
                });
                let synced = false;
                if (navigator.onLine) {
                    await syncPendingData();
                    const remaining = await listPendingOfflineItems();
                    synced = !remaining.some(item => item.sequence === queued.sequence);
                }
                if (!synced) {
                    updateTaskLocalState(task.id, {
                        status: 'completed',
                        completed_at: completedAt,
                        total_duration_minutes: totalDurationMinutes,
                        checklist_state: task.checklist_state || {}
                    });
                }
                return { completedAt, totalDurationMinutes, synced };
            } finally {
                activeOfflineTaskOperations.delete(operationKey);
            }
        }

        async function requestCleaningCompletion(taskId) {
            const task = allTasksCache.find(item => String(item.id) === String(taskId));
            if (!task) return;
            const assignedMember = taskTeamMembers.find(member =>
                String(member.id) === String(task.assigned_team_member_id)
            );
            const trackingEnabled = userRole === 'cleaner'
                ? currentTeamMemberPreferences.track_hours
                : assignedMember?.track_hours === true;

            if (trackingEnabled) {
                if (!task.started_at) {
                    alert(i18n[currentLang].time_task_not_started);
                    return;
                }
                openTimeConfirmation(task);
                return;
            }

            try {
                const { synced } = await queueCleaningCompletion(task, null);
                closeTaskModal();
                if (synced) await refreshTaskAndIncidentViews();
            } catch (error) {
                console.error('Erro ao concluir a limpeza:', error);
                alert(`${i18n[currentLang].time_confirmation_error}: ${error.message}`);
            }
        }

        function openTimeConfirmation(task) {
            const startTimestamp = new Date(task.started_at).getTime();
            if (!Number.isFinite(startTimestamp)) {
                alert(i18n[currentLang].time_task_not_started);
                return;
            }
            const elapsedMinutes = Math.max(1, Math.round((Date.now() - startTimestamp) / 60000));
            taskAwaitingTimeConfirmation = { taskId: task.id, startedAt: task.started_at };
            document.getElementById('time-confirmation-elapsed').innerText = formatTaskDuration(elapsedMinutes);
            document.getElementById('time-confirmation-hours').value = String(Math.floor(elapsedMinutes / 60));
            document.getElementById('time-confirmation-minutes').value = String(elapsedMinutes % 60);
            document.getElementById('time-confirmation-error').classList.add('hidden');
            document.getElementById('time-confirmation-modal').classList.remove('hidden');
            document.getElementById('time-confirmation-submit').focus();
        }

        async function confirmCleaningTime() {
            if (!taskAwaitingTimeConfirmation) return;
            const hours = Number(document.getElementById('time-confirmation-hours').value);
            const minutes = Number(document.getElementById('time-confirmation-minutes').value);
            const durationMinutes = (hours * 60) + minutes;
            const errorMessage = document.getElementById('time-confirmation-error');
            if (!Number.isInteger(hours) || hours < 0 || hours > 168 ||
                !Number.isInteger(minutes) || minutes < 0 || minutes > 59 ||
                durationMinutes < 1 || durationMinutes > 10080) {
                errorMessage.innerText = i18n[currentLang].time_confirmation_invalid;
                errorMessage.classList.remove('hidden');
                return;
            }

            const submitButton = document.getElementById('time-confirmation-submit');
            submitButton.disabled = true;
            submitButton.innerText = i18n[currentLang].time_confirmation_saving;
            errorMessage.classList.add('hidden');
            try {
                const taskId = taskAwaitingTimeConfirmation.taskId;
                const task = allTasksCache.find(item => String(item.id) === String(taskId));
                if (!task) throw new Error('A limpeza não está disponível para concluir.');
                const { synced } = await queueCleaningCompletion(task, durationMinutes);
                taskAwaitingTimeConfirmation = null;
                document.getElementById('time-confirmation-modal').classList.add('hidden');
                closeTaskModal();
                if (synced) {
                    await refreshTaskAndIncidentViews();
                    const finishedTask = allTasksCache.find(item => String(item.id) === String(taskId));
                    if (finishedTask) await openTaskModal(finishedTask);
                }
            } catch (error) {
                console.error('Erro ao confirmar o tempo da limpeza:', error);
                errorMessage.innerText = `${i18n[currentLang].time_confirmation_error}: ${error.message}`;
                errorMessage.classList.remove('hidden');
            } finally {
                submitButton.disabled = false;
                submitButton.innerText = i18n[currentLang].time_confirmation_confirm;
            }
        }

        async function uploadFotoLimpeza(file, propertyId, taskId) {
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

        async function queueTaskPhoto(file, task, photoField = null) {
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

            const queued = await savePendingOfflineItem({
                type: 'task_photo',
                taskId: task.id,
                propertyId: task.property_id,
                photoField,
                file,
                storagePath: `${currentUser.id}/${task.property_id}/${task.id}/${crypto.randomUUID()}.${extension}`
            });
            if (!navigator.onLine) return false;
            await syncPendingData();
            const pending = await listPendingOfflineItems();
            return !pending.some(item => item.sequence === queued.sequence);
        }

        function dataURLtoBlob(dataurl) {
            if (!dataurl || !dataurl.startsWith('data:')) return dataurl;
            const arr = dataurl.split(',');
            const mime = arr[0].match(/:(.*?);/)[1];
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }
            return new Blob([u8arr], { type: mime });
        }

        function getIncidentPhotoExtension(file) {
            const extensionByType = {
                'image/jpeg': 'jpg',
                'image/png': 'png',
                'image/webp': 'webp',
                'image/gif': 'gif',
                'image/heic': 'heic',
                'image/heif': 'heif'
            };
            const fileType = typeof file === 'string' && file.startsWith('data:')
                ? file.match(/^data:([^;,]+);/i)?.[1]
                : file?.type;
            if (!fileType) return null;
            return extensionByType[fileType.toLowerCase()] || null;
        }

        function getIncidentTypeLabel(type) {
            if (type === 'note') return i18n[currentLang].incident_note;
            if (type === 'forgotten_item') return i18n[currentLang].incident_forgotten_item;
            if (type === 'damage') return i18n[currentLang].incident_damage;
            return i18n[currentLang].incident_kind;
        }

        function openIncidentReportModal(propertyId) {
            if (!currentUser || !propertyId) {
                alert(i18n[currentLang].incident_error);
                return;
            }
            incidentTaskContext = { propertyId };
            const form = document.getElementById('incident-report-form');
            form.reset();
            clearIncidentPhotos();
            updateIncidentNetworkStatus();
            document.getElementById('incident-report-message').classList.add('hidden');
            document.getElementById('incident-report-modal').classList.remove('hidden');
        }

        function updateIncidentNetworkStatus() {
            const status = document.getElementById('incident-network-status');
            if (!status) return;
            const online = navigator.onLine;
            status.textContent = online ? `● ${i18n[currentLang].incident_online}` : `● ${i18n[currentLang].incident_offline}`;
            status.classList.toggle('bg-emerald-50', online);
            status.classList.toggle('text-emerald-800', online);
            status.classList.toggle('bg-amber-50', !online);
            status.classList.toggle('text-amber-800', !online);
        }

        function clearIncidentPhotos() {
            incidentSelectedFiles.forEach(photo => URL.revokeObjectURL(photo.previewUrl));
            incidentSelectedFiles = [];
            document.getElementById('incident-photo-preview').replaceChildren();
            document.getElementById('incident-camera-input').value = '';
            document.getElementById('incident-gallery-input').value = '';
        }

        function renderIncidentPhotoPreviews() {
            const preview = document.getElementById('incident-photo-preview');
            preview.replaceChildren(...incidentSelectedFiles.map((photo, index) => {
                const wrapper = document.createElement('div');
                wrapper.className = 'relative aspect-square';
                const image = document.createElement('img');
                image.src = photo.previewUrl;
                image.alt = '';
                image.className = 'h-full w-full rounded-xl border border-slate-200 object-cover';
                const removeButton = document.createElement('button');
                removeButton.type = 'button';
                removeButton.className = 'absolute right-1 top-1 rounded-full bg-slate-950/75 px-2 py-1 text-xs font-bold text-white';
                removeButton.setAttribute('aria-label', currentLang === 'pt' ? 'Remover fotografia' : 'Remove photo');
                removeButton.textContent = '×';
                removeButton.addEventListener('click', () => {
                    URL.revokeObjectURL(incidentSelectedFiles[index].previewUrl);
                    incidentSelectedFiles.splice(index, 1);
                    renderIncidentPhotoPreviews();
                });
                wrapper.append(image, removeButton);
                return wrapper;
            }));
        }

        function addIncidentPhotos(fileList, input) {
            const files = Array.from(fileList || []);
            if (files.some(file => !getIncidentPhotoExtension(file) || file.size > 10 * 1024 * 1024)) {
                showPropertyMessage('incident-report-message', i18n[currentLang].incident_photo_error, 'error');
                input.value = '';
                return;
            }
            files.forEach(file => incidentSelectedFiles.push({
                file,
                previewUrl: URL.createObjectURL(file)
            }));
            input.value = '';
            renderIncidentPhotoPreviews();
            document.getElementById('incident-report-message').classList.add('hidden');
        }

        function closeIncidentReportModal() {
            document.getElementById('incident-report-modal').classList.add('hidden');
            clearIncidentPhotos();
            incidentTaskContext = null;
        }

        async function submitPropertyIncident(event) {
            event.preventDefault();
            if (!incidentTaskContext || !currentUser) {
                showPropertyMessage('incident-report-message', i18n[currentLang].incident_error, 'error');
                return;
            }

            if (incidentSelectedFiles.some(photo =>
                !getIncidentPhotoExtension(photo.file) || photo.file.size > 10 * 1024 * 1024
            )) {
                showPropertyMessage('incident-report-message', i18n[currentLang].incident_photo_error, 'error');
                return;
            }
            const description = document.getElementById('incident-description').value.trim();
            if (!description) {
                showPropertyMessage('incident-report-message', i18n[currentLang].incident_description_required, 'error');
                return;
            }
            const submitButton = document.getElementById('incident-submit-button');
            const message = document.getElementById('incident-report-message');
            submitButton.disabled = true;
            submitButton.innerText = i18n[currentLang].incident_submitting;
            message.classList.add('hidden');

            try {
                const incidentId = crypto.randomUUID();
                const files = incidentSelectedFiles.map(({ file }) => ({
                    file,
                    storagePath: `${currentUser.id}/${incidentTaskContext.propertyId}/${incidentId}/${crypto.randomUUID()}.${getIncidentPhotoExtension(file)}`
                }));
                const priority = document.getElementById('incident-priority').value;

                const queued = await savePendingOfflineItem({
                    type: 'incident',
                    incidentId,
                    propertyId: incidentTaskContext.propertyId,
                    incidentType: document.getElementById('incident-type').value,
                    description,
                    priority,
                    isPriority: priority === 'urgent',
                    files,
                    createdAtISO: new Date().toISOString()
                });
                let synced = false;
                if (navigator.onLine) {
                    await syncPendingData();
                    const pending = await listPendingOfflineItems();
                    synced = !pending.some(item => item.sequence === queued.sequence);
                }

                showPropertyMessage(
                    'incident-report-message',
                    synced ? i18n[currentLang].incident_saved
                        : navigator.onLine ? i18n[currentLang].offline_sync_error : i18n[currentLang].offline_saved,
                    'success'
                );
                document.getElementById('incident-report-form').reset();
                clearIncidentPhotos();
                if (synced) {
                    await refreshTaskAndIncidentViews();
                } else if (userRole === 'admin') {
                    await carregarAlertasIncidentes();
                }
            } catch (error) {
                console.error('Erro ao reportar incidente:', error);
                showPropertyMessage('incident-report-message', `${i18n[currentLang].incident_error}: ${error.message}`, 'error');
            } finally {
                submitButton.disabled = false;
                submitButton.innerText = i18n[currentLang].incident_submit;
            }
        }

        document.getElementById('incident-camera-input')?.addEventListener('change', event => {
            addIncidentPhotos(event.target.files, event.target);
        });
        document.getElementById('incident-gallery-input')?.addEventListener('change', event => {
            addIncidentPhotos(event.target.files, event.target);
        });

        async function handleTaskPhotoUpload(event, taskId, propertyId) {
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
                if (!task) throw new Error('A tarefa não está disponível para atualizar a galeria.');
                const synced = await queueTaskPhoto(file, task);
                await openTaskModal(task);
                const refreshedMessage = document.getElementById('task-photo-message');
                if (refreshedMessage) {
                    refreshedMessage.innerText = synced
                        ? i18n[currentLang].photo_upload_success
                        : navigator.onLine ? i18n[currentLang].offline_sync_error : i18n[currentLang].offline_saved;
                    refreshedMessage.className = `text-[11px] font-semibold ${synced ? 'text-emerald-700' : 'text-amber-700'}`;
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
            const file = event.target.files?.[0];
            const task = allTasksCache.find(item => String(item.id) === String(taskId));
            if (!file || !task) return;
            try {
                const synced = await queueTaskPhoto(file, task, photoField);
                if (synced) {
                    await loadData();
                }
                await openTaskModal(task);
                const message = document.getElementById('task-photo-message');
                if (message) {
                    message.innerText = synced
                        ? i18n[currentLang].photo_upload_success
                        : navigator.onLine ? i18n[currentLang].offline_sync_error : i18n[currentLang].offline_saved;
                    message.className = `text-[11px] font-semibold ${synced ? 'text-emerald-700' : 'text-amber-700'}`;
                }
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

        function subscribePlan(plan) {
            const paymentLinks = {
                starter: 'https://buy.stripe.com/test_3cIdR1h0leJFaZVcmodwc03',
                pro: 'https://buy.stripe.com/test_14AfZ9eSd0SPec79acdwc02',
                business: 'https://buy.stripe.com/test_7sY4gr39v'
            };
            const paymentLink = Object.prototype.hasOwnProperty.call(paymentLinks, plan)
                ? paymentLinks[plan]
                : null;

            if (!paymentLink) {
                console.error(`Plano de subscrição inválido: ${plan}`);
                return;
            }

            if (!currentUser?.id || !currentUser.email) {
                alert('Inicie sessão com a sua conta Host a Cleaner antes de subscrever um plano.');
                return;
            }

            const checkoutUrl = new URL(paymentLink);
            checkoutUrl.searchParams.set('client_reference_id', currentUser.id);
            checkoutUrl.searchParams.set('prefilled_email', currentUser.email);
            window.location.href = checkoutUrl.toString();
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
            await refreshTaskAndIncidentViews();
        }

        function closeTaskModal() {
            if (taskAwaitingTimeConfirmation) return;
            document.getElementById('task-modal').classList.add('hidden');
            offlinePendingPhotoUrls.forEach(url => URL.revokeObjectURL(url));
            offlinePendingPhotoUrls = [];
        }

        function setTaskModalSyncMessage(message, type) {
            const element = document.getElementById('task-manual-sync-message');
            element.textContent = message;
            element.className = `text-[11px] font-semibold ${type === 'error' ? 'text-rose-600' : type === 'pending' ? 'text-amber-700' : 'text-emerald-700'}`;
            element.setAttribute('role', type === 'error' ? 'alert' : 'status');
        }

        async function syncTaskModalData() {
            const button = document.getElementById('btn-task-manual-sync');
            const icon = button.querySelector('span[aria-hidden="true"]');
            const taskId = button.dataset.taskId;
            const task = allTasksCache.find(item => String(item.id) === String(taskId));
            button.disabled = true;
            icon.classList.add('animate-spin');
            try {
                if (!currentUser) throw new Error(i18n[currentLang].offline_sync_account);
                if (!task) throw new Error('A tarefa não está disponível para sincronizar.');

                if (userRole === 'admin') {
                    const cleanerNotes = document.getElementById('task-notes').value;
                    const pending = await listPendingOfflineItems();
                    const hasQueuedNotes = pending.some(item =>
                        item.type === 'task_notes'
                        && item.userId === currentUser.id
                        && String(item.taskId) === String(task.id)
                    );
                    if (cleanerNotes !== (task.cleaner_notes || '') || hasQueuedNotes) {
                        await queueTaskNotesForSync(task.id, cleanerNotes);
                        task.cleaner_notes = cleanerNotes;
                    }
                }

                if (!navigator.onLine) {
                    await updateOfflineIndicator();
                    setTaskModalSyncMessage(i18n[currentLang].task_sync_offline, 'pending');
                    return;
                }

                await forcePendingSync();
                const remaining = await listPendingOfflineItems();
                const hasPending = remaining.some(item => item.userId === currentUser.id);
                setTaskModalSyncMessage(
                    hasPending ? i18n[currentLang].task_sync_pending : i18n[currentLang].task_sync_complete,
                    hasPending ? 'pending' : 'success'
                );
            } catch (error) {
                console.error('Erro ao sincronizar dados locais da tarefa:', error);
                setTaskModalSyncMessage(`${i18n[currentLang].task_sync_error}: ${error.message}`, 'error');
            } finally {
                button.disabled = false;
                icon.classList.remove('animate-spin');
            }
        }

        async function saveTaskModalDetails(taskId) {
            if (!requireAdminAction()) return;
            const status = document.getElementById(`modal-status-${taskId}`).value;
            const task = allTasksCache.find(item => String(item.id) === String(taskId));
            if (!task) return;
            const assignedTeamMemberId = document.getElementById('task-assigned-member').value || null;
            const assignedMember = taskTeamMembers.find(member =>
                String(member.id) === String(assignedTeamMemberId)
            );
            const cleaner_notes = document.getElementById('task-notes').value;
            const hoursInput = document.getElementById(`modal-hours-${taskId}`);
            const hoursValue = hoursInput?.value.trim() || '';
            const hours_spent = hoursValue === '' ? null : Number(hoursValue);
            if (hours_spent !== null && (!Number.isFinite(hours_spent) || hours_spent < 0.25 || hours_spent > 168)) {
                alert(i18n[currentLang].task_hours_invalid);
                return;
            }
            if (normalizeTaskStatus(status) === 'completed' && !isTaskCompleted(task) && assignedMember?.track_hours && hours_spent === null) {
                alert(i18n[currentLang].task_hours_invalid);
                return;
            }

            const taskUpdates = { cleaner_notes };
            taskUpdates.assigned_team_member_id = assignedTeamMemberId;
            if (hours_spent !== null) taskUpdates.hours_spent = hours_spent;
            try {
                const { error: detailsError } = await supabaseClient
                    .from('cleaning_tasks')
                    .update(taskUpdates)
                    .eq('id', taskId);
                if (detailsError) throw detailsError;

                if (normalizeTaskStatus(status) === 'completed' && !isTaskCompleted(task)) {
                    let startedAt = task.started_at;
                    if (!startedAt) {
                        const requestedStart = new Date().toISOString();
                        const { data, error } = await supabaseClient.rpc('sync_cleaning_task_start', {
                            p_task_id: task.id,
                            p_started_at: requestedStart
                        });
                        if (error) throw error;
                        startedAt = data || requestedStart;
                    }

                    const { error } = await supabaseClient.rpc('sync_cleaning_task_completion', {
                        p_task_id: task.id,
                        p_started_at: startedAt,
                        p_completed_at: new Date().toISOString(),
                        p_total_duration_minutes: hours_spent === null ? null : Math.round(hours_spent * 60),
                        p_checklist_state: task.checklist_state || {}
                    });
                    if (error) throw error;
                } else {
                    const { error } = await supabaseClient
                        .from('cleaning_tasks')
                        .update({ status })
                        .eq('id', taskId);
                    if (error) throw error;
                }
            } catch (error) {
                console.error('Erro ao guardar os detalhes da limpeza:', error);
                alert('Erro ao guardar as alterações: ' + error.message);
                return;
            }

            alert('Atualizado com sucesso!');
            closeTaskModal();
            closeDayTasksModal();
            await refreshTaskAndIncidentViews();
        }

        async function fetchHistoryAdmin() {
            const historyListEl = document.getElementById('history-tasks-list');
            const totalHoursBadge = document.getElementById('total-hours-badge');
            const totalAmountBadge = document.getElementById('total-amount-badge');
            if (!historyListEl || !currentUser) return;

            const completedTasks = allTasksCache.filter(t => isTaskCompleted(t));

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
                    <div class="border ${isPaid ? 'border-emerald-900 bg-emerald-950/30' : 'border-amber-900 bg-amber-950/20'} p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs">
                        <div class="space-y-1">
                            <div class="flex items-center gap-2">
                                <strong class="text-slate-100">${escapePropertyHTML(task.properties?.name || 'Alojamento')}</strong>
                                <span class="text-slate-400">📅 ${escapePropertyHTML(task.scheduled_date)}</span>
                            </div>
                            ${task.cleaner_notes ? `<p class="text-slate-400">💬 "${escapePropertyHTML(task.cleaner_notes)}"</p>` : ''}
                        </div>
                        <div class="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 shrink-0">
                            <span class="font-bold text-slate-200">${hours}h × ${rate.toFixed(2)}€ = ${taskTotal.toFixed(2)}€</span>
                            
                            ${userRole === 'admin' ? `
                                <button onclick="togglePaymentStatus('${task.id}', '${task.payment_status || 'pending'}')" class="px-3 py-1.5 rounded-xl font-bold transition ${isPaid ? 'bg-emerald-800 text-emerald-100 shadow-sm' : 'bg-amber-800 text-amber-100 shadow-sm hover:bg-amber-700'}">
                                    ${isPaid ? `🟢 ${i18n[currentLang].finance_paid}` : `⏳ ${i18n[currentLang].finance_pending}`}
                                </button>
                            ` : `
                                <span class="px-3 py-1.5 rounded-xl font-bold ${isPaid ? 'bg-emerald-950 text-emerald-200' : 'bg-amber-950 text-amber-200'}">
                                    ${isPaid ? `🟢 ${i18n[currentLang].finance_paid}` : `⏳ ${i18n[currentLang].finance_pending}`}
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

        function formatEmployeeHoursHours(value) {
            const numericValue = Number(value) || 0;
            if (!Number.isFinite(numericValue)) return '0h';
            const roundedValue = Math.round((numericValue + Number.EPSILON) * 10) / 10;
            return `${roundedValue.toFixed(roundedValue % 1 === 0 ? 0 : 1)}h`;
        }

        function escapeCsvCell(value) {
            const safeValue = String(value ?? '');
            return `"${safeValue.replace(/"/g, '""')}"`;
        }

        function triggerCsvDownload(filename, rows) {
            if (!Array.isArray(rows) || !rows.length) return;
            const csvContent = '\uFEFF' + rows.map(row => row.map(cell => escapeCsvCell(cell)).join(';')).join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }

        function sanitizeCsvFilename(value) {
            return String(value || 'funcionario')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-zA-Z0-9_-]+/g, '-')
                .replace(/^-+|-+$/g, '')
                .slice(0, 40) || 'funcionario';
        }

        function exportEmployeeHoursSummaryCsv() {
            if (!Array.isArray(employeeHoursMonthlyData) || !employeeHoursMonthlyData.length) return;
            const rows = [
                ['Nome do Funcionário', 'Total de Limpezas', 'Total de Horas'],
                ...employeeHoursMonthlyData.map(member => [
                    member.name || 'Funcionário',
                    Number(member.totalCleanings) || 0,
                    Number(member.totalHours || 0).toFixed(2)
                ])
            ];
            const monthValue = new Date().toISOString().slice(0, 7);
            triggerCsvDownload(`horas-funcionarios-${monthValue}.csv`, rows);
        }

        function exportEmployeeHoursDetailCsv(memberId) {
            const member = (employeeHoursMonthlyData || []).find(item => String(item.id) === String(memberId));
            if (!member) return;
            const rows = [
                ['Data', 'Alojamento', 'Tipo de Tarefa', 'Duração'],
                ...[...member.tasks]
                    .sort((a, b) => new Date(b.scheduledDate) - new Date(a.scheduledDate))
                    .map(task => [
                        task.scheduledDate ? new Date(task.scheduledDate).toISOString().slice(0, 10) : '-',
                        task.propertyName || 'Imóvel',
                        task.type || 'Limpeza',
                        Number(task.hours || 0).toFixed(2)
                    ])
            ];
            const monthValue = new Date().toISOString().slice(0, 7);
            triggerCsvDownload(`${sanitizeCsvFilename(member.name || 'funcionario')}-extrato-${monthValue}.csv`, rows);
        }

        function openEmployeeHoursDetailModal(memberId) {
            const modal = document.getElementById('employee-hours-detail-modal');
            const body = document.getElementById('employee-hours-detail-modal-body');
            const title = document.getElementById('employee-hours-detail-title');
            if (!modal || !body || !title) return;

            const member = (employeeHoursMonthlyData || []).find(item => String(item.id) === String(memberId));
            if (!member) return;

            const rows = [...member.tasks]
                .sort((a, b) => new Date(b.scheduledDate) - new Date(a.scheduledDate))
                .map(task => {
                    const taskType = task.type || 'Limpeza';
                    return `
                        <tr class="border-b border-slate-200 text-left text-[11px] text-slate-600 last:border-b-0">
                            <td class="px-2 py-2">${escapePropertyHTML(task.scheduledDate ? new Date(task.scheduledDate).toLocaleDateString(currentLang === 'en' ? 'en-GB' : 'pt-PT') : '--')}</td>
                            <td class="px-2 py-2 font-semibold text-slate-700">${escapePropertyHTML(task.propertyName)}</td>
                            <td class="px-2 py-2">${escapePropertyHTML(taskType)}</td>
                            <td class="px-2 py-2 text-right font-bold text-slate-800">${formatEmployeeHoursHours(task.hours)}</td>
                        </tr>
                    `;
                }).join('');

            const initials = (member.name || 'F')
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map(part => part[0].toUpperCase())
                .join('') || 'F';

            title.textContent = member.name || 'Funcionário';
            body.innerHTML = `
                <div class="space-y-5">
                    <div class="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div class="flex items-center gap-3">
                            <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-base font-black text-indigo-700">${escapePropertyHTML(initials)}</div>
                            <div>
                                <h4 class="text-base font-extrabold text-slate-900">${escapePropertyHTML(member.name)}</h4>
                                <p class="text-[11px] text-slate-500">${member.totalCleanings} ${currentLang === 'en' ? 'cleanings' : 'limpezas'} neste mês</p>
                            </div>
                        </div>
                        <div class="flex flex-wrap items-center gap-2">
                            <div class="rounded-2xl bg-indigo-600 px-3 py-2 text-left text-white">
                                <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-100">${currentLang === 'en' ? 'Hours' : 'Horas'}</p>
                                <p class="text-lg font-black">${formatEmployeeHoursHours(member.totalHours)}</p>
                            </div>
                            <div class="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left">
                                <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">${currentLang === 'en' ? 'Cleanings' : 'Limpezas'}</p>
                                <p class="text-lg font-black text-slate-900">${member.totalCleanings}</p>
                            </div>
                        </div>
                    </div>

                    <div class="flex justify-end">
                        <button type="button" data-export-employee-detail="${escapePropertyHTML(String(member.id))}" class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-600">
                            Exportar Extrato (CSV)
                        </button>
                    </div>

                    <div class="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        <div class="overflow-x-auto">
                            <table class="min-w-full border-collapse">
                                <thead class="bg-slate-100">
                                    <tr class="text-left text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                                        <th class="px-2 py-2">${currentLang === 'en' ? 'Date' : 'Data'}</th>
                                        <th class="px-2 py-2">${currentLang === 'en' ? 'Accommodation' : 'Alojamento'}</th>
                                        <th class="px-2 py-2">${currentLang === 'en' ? 'Task type' : 'Tipo de tarefa'}</th>
                                        <th class="px-2 py-2 text-right">${currentLang === 'en' ? 'Duration' : 'Duração'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${rows || `
                                        <tr>
                                            <td colspan="4" class="px-2 py-4 text-center text-[11px] text-slate-500">${currentLang === 'en' ? 'No tasks recorded for this member in the current month.' : 'Sem tarefas registadas para este colaborador no mês atual.'}</td>
                                        </tr>
                                    `}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;

            const exportButton = body.querySelector('[data-export-employee-detail]');
            exportButton?.addEventListener('click', () => exportEmployeeHoursDetailCsv(member.id));

            modal.classList.remove('hidden');
            modal.classList.add('flex');
            document.body.classList.add('overflow-hidden');
        }

        function closeEmployeeHoursDetailModal() {
            const modal = document.getElementById('employee-hours-detail-modal');
            if (!modal) return;
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            document.body.classList.remove('overflow-hidden');
        }

        function renderEmployeeHoursView() {
            const summaryContainer = document.getElementById('employee-hours-summary');
            const gridContainer = document.getElementById('employee-hours-grid');
            if (!summaryContainer || !gridContainer) return;

            const currentMonth = new Date();
            const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
            const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59, 999);
            const monthFormatter = new Intl.DateTimeFormat(currentLang === 'en' ? 'en-US' : 'pt-PT', {
                month: 'long',
                year: 'numeric'
            });

            const memberMap = new Map();
            const completedTasks = (allTasksCache || []).filter(task => {
                const taskDateString = task.scheduled_date || task.completed_at || task.created_at;
                if (!taskDateString || !task.assigned_team_member_id || !isTaskCompleted(task)) return false;
                const taskDate = new Date(taskDateString);
                if (Number.isNaN(taskDate.getTime())) return false;
                return taskDate >= monthStart && taskDate <= monthEnd;
            });

            completedTasks.forEach(task => {
                const memberId = String(task.assigned_team_member_id);
                const memberMeta = allTeamMembersCache.find(member => String(member.id) === memberId)
                    || propertyCleaners.find(member => String(member.id) === memberId)
                    || { id: memberId, name: 'Funcionário sem nome', email: '' };
                const hours = Number(task.hours_spent ?? (task.total_duration_minutes ? task.total_duration_minutes / 60 : 0)) || 0;
                const propertyName = task.properties?.name
                    || allPropertiesCache.find(property => String(property.id) === String(task.property_id))?.name
                    || 'Imóvel';

                if (!memberMap.has(memberId)) {
                    memberMap.set(memberId, {
                        id: memberId,
                        name: memberMeta.name || memberMeta.email || 'Funcionário sem nome',
                        totalHours: 0,
                        totalCleanings: 0,
                        tasks: []
                    });
                }

                const member = memberMap.get(memberId);
                member.totalHours += hours;
                member.totalCleanings += 1;
                member.tasks.push({
                    propertyName,
                    hours,
                    scheduledDate: task.scheduled_date || task.completed_at || task.created_at || new Date().toISOString(),
                    status: task.status,
                    type: task.task_type || task.type || 'Limpeza'
                });
            });

            employeeHoursMonthlyData = [...memberMap.values()].sort((a, b) => b.totalHours - a.totalHours || b.totalCleanings - a.totalCleanings);
            const members = [...employeeHoursMonthlyData];
            const totalTeamHours = members.reduce((sum, member) => sum + (Number(member.totalHours) || 0), 0);
            const totalTeamCleanings = members.reduce((sum, member) => sum + (Number(member.totalCleanings) || 0), 0);
            const monthLabel = monthFormatter.format(currentMonth);

            summaryContainer.innerHTML = `
                <div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                    <div>
                        <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-500">${currentLang === 'en' ? 'Current month' : 'Mês atual'}</p>
                        <h3 class="mt-1 text-lg font-extrabold text-slate-900">${monthLabel}</h3>
                    </div>
                    <div class="rounded-2xl bg-indigo-600 px-4 py-3 text-left text-white shadow-md xl:text-right">
                        <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-100">${currentLang === 'en' ? 'Team total' : 'Total da equipa'}</p>
                        <p class="mt-1 text-2xl font-black">${formatEmployeeHoursHours(totalTeamHours)}</p>
                    </div>
                </div>
                <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div class="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">${currentLang === 'en' ? 'Employees' : 'Funcionários'}</p>
                        <p class="mt-1 text-xl font-black text-slate-900">${members.length}</p>
                    </div>
                    <div class="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">${currentLang === 'en' ? 'Cleanings' : 'Limpezas'}</p>
                        <p class="mt-1 text-xl font-black text-slate-900">${totalTeamCleanings}</p>
                    </div>
                    <div class="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">${currentLang === 'en' ? 'Average' : 'Média'}</p>
                        <p class="mt-1 text-xl font-black text-slate-900">${members.length ? formatEmployeeHoursHours(totalTeamHours / members.length) : '0h'}</p>
                    </div>
                    <div class="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">${currentLang === 'en' ? 'Completed' : 'Concluídas'}</p>
                        <p class="mt-1 text-xl font-black text-slate-900">${completedTasks.length}</p>
                    </div>
                </div>
            `;

            if (!members.length) {
                gridContainer.innerHTML = `
                    <div class="col-span-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                        <p class="text-xs font-semibold text-slate-500">${currentLang === 'en' ? 'No completed cleanings were recorded for this month yet.' : 'Ainda não existem limpezas concluídas neste mês.'}</p>
                    </div>
                `;
                return;
            }

            gridContainer.innerHTML = members.map(member => {
                const initials = (member.name || 'F')
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map(part => part[0].toUpperCase())
                    .join('') || 'F';
                const recentTasks = [...member.tasks]
                    .sort((a, b) => new Date(b.scheduledDate) - new Date(a.scheduledDate))
                    .slice(0, 3);

                return `
                    <article class="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div class="flex items-start justify-between gap-3">
                            <div class="flex items-center gap-3">
                                <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-100 text-sm font-black text-indigo-700">${escapePropertyHTML(initials)}</div>
                                <div>
                                    <h4 class="text-sm font-bold text-slate-900">${escapePropertyHTML(member.name)}</h4>
                                    <p class="text-[11px] text-slate-500">${member.totalCleanings} ${currentLang === 'en' ? 'cleanings' : 'limpezas'}</p>
                                </div>
                            </div>
                            <div class="text-right">
                                <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">${currentLang === 'en' ? 'Hours' : 'Horas'}</p>
                                <p class="text-xl font-black text-slate-900">${formatEmployeeHoursHours(member.totalHours)}</p>
                            </div>
                        </div>

                        <div class="mt-4 space-y-2">
                            ${recentTasks.map(task => `
                                <div class="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-2.5 py-2 text-[11px] text-slate-600">
                                    <span class="truncate font-semibold">${escapePropertyHTML(task.propertyName)}</span>
                                    <span class="shrink-0 font-bold text-slate-800">${formatEmployeeHoursHours(task.hours)}</span>
                                </div>
                            `).join('')}
                        </div>

                        <button type="button" data-employee-detail-id="${escapePropertyHTML(String(member.id))}" class="employee-hours-detail-btn mt-4 w-full rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-[11px] font-bold text-indigo-700 transition hover:bg-indigo-100">
                            ${currentLang === 'en' ? 'View full detail' : 'Ver detalhe completo'}
                        </button>
                    </article>
                `;
            }).join('');

            const modal = document.getElementById('employee-hours-detail-modal');
            if (modal && !modal.dataset.bound) {
                modal.dataset.bound = 'true';
                modal.addEventListener('click', event => {
                    if (event.target === modal) closeEmployeeHoursDetailModal();
                });
            }

            if (!window.__employeeHoursEscapeBound) {
                window.__employeeHoursEscapeBound = true;
                document.addEventListener('keydown', event => {
                    if (event.key === 'Escape') {
                        const modalRef = document.getElementById('employee-hours-detail-modal');
                        if (modalRef && !modalRef.classList.contains('hidden')) {
                            closeEmployeeHoursDetailModal();
                        }
                    }
                });
            }

            gridContainer.querySelectorAll('.employee-hours-detail-btn').forEach(button => {
                button.addEventListener('click', () => openEmployeeHoursDetailModal(button.dataset.employeeDetailId));
            });
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
                .select('id, work_date, hours, description, team_members!work_time_entries_team_member_id_fkey(name), properties!work_time_entries_property_id_fkey(name)')
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

        function getDefaultFinancialDateRange() {
            const today = getLocalDateString();
            const [year, month] = today.split('-').map(Number);
            return {
                startDate: getLocalDateString(new Date(year, month - 12, 1, 12)),
                endDate: today
            };
        }

        function validateFinancialDateRange(startDate, endDate) {
            if (!startDate || !endDate
                || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)
                || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)
                || startDate > endDate) {
                throw new Error('Indique um intervalo de datas válido.');
            }
        }

        async function fetchFinancialEntriesForDateRange(startDate, endDate) {
            validateFinancialDateRange(startDate, endDate);
            if (!currentUser) throw new Error('É necessário iniciar sessão para consultar os movimentos.');
            const { data, error } = await supabaseClient
                .from('property_financial_entries')
                .select('property_id, entry_type, amount, description, occurred_on, status')
                .eq('user_id', currentUser.id)
                .gte('occurred_on', startDate)
                .lte('occurred_on', endDate)
                .order('occurred_on', { ascending: true });
            if (error) throw error;
            return data || [];
        }

        async function renderFinancialChart(startDate, endDate) {
            const canvas = document.getElementById('financialOverviewChart');
            const errorEl = document.getElementById('financialOverviewChart-error');
            if (!canvas || !currentUser || userRole !== 'admin') return false;

            const requestId = ++financialChartRequestId;
            errorEl.classList.add('hidden');
            try {
                if (!window.Chart) throw new Error('A biblioteca Chart.js não foi carregada.');
                const defaultRange = getDefaultFinancialDateRange();
                const selectedStartDate = startDate || financialChartStartDate || defaultRange.startDate;
                const selectedEndDate = endDate || financialChartEndDate || defaultRange.endDate;
                validateFinancialDateRange(selectedStartDate, selectedEndDate);
                const entries = await fetchFinancialEntriesForDateRange(selectedStartDate, selectedEndDate);
                if (requestId !== financialChartRequestId) return;
                financialChartStartDate = selectedStartDate;
                financialChartEndDate = selectedEndDate;

                const months = [];
                const [startYear, startMonth] = selectedStartDate.split('-').map(Number);
                const [endYear, endMonth] = selectedEndDate.split('-').map(Number);
                for (let year = startYear, month = startMonth; year < endYear || (year === endYear && month <= endMonth);) {
                    months.push(`${year}-${String(month).padStart(2, '0')}`);
                    month += 1;
                    if (month > 12) {
                        month = 1;
                        year += 1;
                    }
                }
                const totals = {
                    airbnb: Array(months.length).fill(0),
                    booking: Array(months.length).fill(0),
                    otherIncome: Array(months.length).fill(0),
                    expenses: Array(months.length).fill(0)
                };
                const monthIndexes = new Map(months.map((month, index) => [month, index]));

                entries.forEach(entry => {
                    const monthIndex = monthIndexes.get(String(entry.occurred_on).slice(0, 7));
                    const amount = Number(entry.amount);
                    if (monthIndex === undefined || !Number.isFinite(amount)) return;
                    if (entry.entry_type === 'expense') {
                        totals.expenses[monthIndex] -= amount;
                    } else if (entry.entry_type === 'income') {
                        const description = String(entry.description || '').toLowerCase();
                        if (description.startsWith('airbnb:')) totals.airbnb[monthIndex] += amount;
                        else if (description.startsWith('booking.com:')) totals.booking[monthIndex] += amount;
                        else totals.otherIncome[monthIndex] += amount;
                    }
                });

                if (financialOverviewChart) financialOverviewChart.destroy();
                financialOverviewChart = new Chart(canvas, {
                    type: 'bar',
                    data: {
                        labels: months.map(month => {
                            const [year, monthNumber] = month.split('-').map(Number);
                            return new Intl.DateTimeFormat(currentLang === 'pt' ? 'pt-PT' : 'en-US', {
                                month: 'short',
                                year: '2-digit'
                            }).format(new Date(year, monthNumber - 1, 1, 12));
                        }),
                        datasets: [
                            { label: 'Airbnb', data: totals.airbnb, backgroundColor: '#f87171', stack: 'income' },
                            { label: 'Booking.com', data: totals.booking, backgroundColor: '#60a5fa', stack: 'income' },
                            { label: currentLang === 'pt' ? 'Outros ganhos' : 'Other income', data: totals.otherIncome, backgroundColor: '#a78bfa', stack: 'income' },
                            { label: currentLang === 'pt' ? 'Despesas' : 'Expenses', data: totals.expenses, backgroundColor: '#fbbf24', stack: 'expenses' }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: { mode: 'index', intersect: false },
                        plugins: {
                            legend: { position: 'bottom', labels: { color: '#cbd5e1' } },
                            tooltip: {
                                callbacks: {
                                    label: context => `${context.dataset.label}: ${formatFinancialAmount(Math.abs(context.parsed.y))}`
                                }
                            }
                        },
                        scales: {
                            x: { stacked: true, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148, 163, 184, 0.12)' } },
                            y: {
                                stacked: true,
                                beginAtZero: true,
                                ticks: {
                                    color: '#94a3b8',
                                    callback: value => formatFinancialAmount(Math.abs(Number(value)))
                                },
                                grid: { color: 'rgba(148, 163, 184, 0.18)' }
                            }
                        }
                    }
                });
                return true;
            } catch (error) {
                if (requestId !== financialChartRequestId) return;
                console.error('Erro ao renderizar o gráfico financeiro:', error);
                if (financialOverviewChart) {
                    financialOverviewChart.destroy();
                    financialOverviewChart = null;
                }
                errorEl.textContent = error.message;
                errorEl.classList.remove('hidden');
                return false;
            }
        }

        function getFinancialDateModalRange() {
            const defaultRange = getDefaultFinancialDateRange();
            return {
                startDate: document.getElementById('financial-date-start').value || financialChartStartDate || defaultRange.startDate,
                endDate: document.getElementById('financial-date-end').value || financialChartEndDate || defaultRange.endDate
            };
        }

        function openFinancialDateModal() {
            const defaultRange = getDefaultFinancialDateRange();
            document.getElementById('financial-date-start').value = financialChartStartDate || defaultRange.startDate;
            document.getElementById('financial-date-end').value = financialChartEndDate || defaultRange.endDate;
            document.getElementById('financial-date-modal-message').classList.add('hidden');
            document.getElementById('financial-date-modal').classList.remove('hidden');
        }

        function closeFinancialDateModal() {
            document.getElementById('financial-date-modal').classList.add('hidden');
        }

        function openCancellationPolicyModal() {
            const modal = document.getElementById('cancellation-policy-modal');
            cancellationPolicyTrigger = document.activeElement;
            cancellationPolicyPreviousOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            modal.classList.remove('hidden');
            document.getElementById('cancellation-policy-close').focus();
        }

        function closeCancellationPolicyModal() {
            document.getElementById('cancellation-policy-modal').classList.add('hidden');
            document.body.style.overflow = cancellationPolicyPreviousOverflow;
            if (cancellationPolicyTrigger?.isConnected) cancellationPolicyTrigger.focus();
            cancellationPolicyTrigger = null;
        }

        function applyFinancialDatePreset(preset) {
            const today = getLocalDateString();
            const [year, month] = today.split('-').map(Number);
            let startDate;
            if (preset === 'this-month') {
                startDate = `${year}-${String(month).padStart(2, '0')}-01`;
            } else if (preset === 'last-3-months') {
                startDate = getLocalDateString(new Date(year, month - 3, 1, 12));
            } else if (preset === 'last-6-months') {
                startDate = getLocalDateString(new Date(year, month - 6, 1, 12));
            } else if (preset === 'this-year') {
                startDate = `${year}-01-01`;
            } else {
                return;
            }
            document.getElementById('financial-date-start').value = startDate;
            document.getElementById('financial-date-end').value = today;
            document.getElementById('financial-date-modal-message').classList.add('hidden');
        }

        async function exportToCSV(startDate, endDate) {
            const range = {
                startDate: startDate || getFinancialDateModalRange().startDate,
                endDate: endDate || getFinancialDateModalRange().endDate
            };
            const entries = await fetchFinancialEntriesForDateRange(range.startDate, range.endDate);
            const escapeCSV = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
            const rows = [
                ['Data', 'Tipo', 'Plataforma', 'Descrição', 'Valor', 'Estado', 'ID do imóvel'],
                ...entries.map(entry => {
                    const description = String(entry.description || '');
                    const platform = description.startsWith('Airbnb:')
                        ? 'Airbnb'
                        : description.startsWith('Booking.com:')
                            ? 'Booking.com'
                            : '';
                    const signedAmount = entry.entry_type === 'expense' ? -Number(entry.amount) : Number(entry.amount);
                    return [
                        entry.occurred_on,
                        entry.entry_type === 'income' ? 'Ganho' : 'Despesa',
                        platform,
                        description,
                        signedAmount.toFixed(2),
                        entry.status || '',
                        entry.property_id || ''
                    ];
                })
            ];
            const csv = `\uFEFF${rows.map(row => row.map(escapeCSV).join(';')).join('\r\n')}`;
            const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
            const link = document.createElement('a');
            link.href = url;
            link.download = `host-a-cleaner-financas-${range.startDate}-${range.endDate}.csv`;
            document.body.append(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        }

        async function exportToPDF(startDate, endDate) {
            const range = {
                startDate: startDate || getFinancialDateModalRange().startDate,
                endDate: endDate || getFinancialDateModalRange().endDate
            };
            const entries = await fetchFinancialEntriesForDateRange(range.startDate, range.endDate);
            if (!window.jspdf?.jsPDF) throw new Error('A biblioteca jsPDF não foi carregada.');
            const pdf = new window.jspdf.jsPDF({ orientation: 'landscape' });
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const left = 14;
            const lineWidth = pageWidth - left * 2;
            let y = 16;

            pdf.setFontSize(16);
            pdf.text('Host a Cleaner - Lançamentos financeiros', left, y);
            y += 8;
            pdf.setFontSize(10);
            pdf.text(`Período: ${range.startDate} a ${range.endDate}`, left, y);
            y += 10;

            if (!entries.length) {
                pdf.text('Não existem movimentos neste período.', left, y);
            } else {
                entries.forEach(entry => {
                    const signedAmount = entry.entry_type === 'expense' ? -Number(entry.amount) : Number(entry.amount);
                    const type = entry.entry_type === 'income' ? 'Ganho' : 'Despesa';
                    const description = `${entry.occurred_on} | ${type} | ${entry.description || ''} | ${signedAmount.toFixed(2)} EUR`;
                    const wrappedLines = pdf.splitTextToSize(description, lineWidth);
                    const rowHeight = wrappedLines.length * 5 + 2;
                    if (y + rowHeight > pageHeight - 14) {
                        pdf.addPage();
                        y = 16;
                    }
                    pdf.text(wrappedLines, left, y);
                    y += rowHeight;
                });
            }

            pdf.save(`host-a-cleaner-financas-${range.startDate}-${range.endDate}.pdf`);
        }

        async function runFinancialExport(exportFunction, button) {
            const message = document.getElementById('financial-date-modal-message');
            const exportButtons = [...document.querySelectorAll('#financial-export-csv, #financial-export-pdf')];
            exportButtons.forEach(exportButton => { exportButton.disabled = true; });
            message.classList.add('hidden');
            try {
                const range = getFinancialDateModalRange();
                await exportFunction(range.startDate, range.endDate);
                message.textContent = 'Exportação concluída.';
                message.className = 'text-xs font-semibold text-emerald-700';
            } catch (error) {
                console.error('Erro ao exportar movimentos financeiros:', error);
                message.textContent = error.message;
                message.className = 'text-xs font-semibold text-rose-600';
            } finally {
                message.classList.remove('hidden');
                exportButtons.forEach(exportButton => { exportButton.disabled = false; });
                button.blur();
            }
        }

        async function carregarRelatorios() {
            const cardsEl = document.getElementById('reports-summary-cards');
            const propertyListEl = document.getElementById('reports-property-list');
            const propertySelect = document.getElementById('financial-property');
            const filterPropertySelect = document.getElementById('financial-filter-property');
            const monthInput = document.getElementById('financial-filter-month');
            if (!cardsEl || !propertyListEl || userRole !== 'admin' || !currentUser) return;

            const requestId = ++reportsRequestId;
            cardsEl.innerHTML = `<p class="text-slate-400 text-xs">${i18n[currentLang].reports_loading}</p>`;
            hidePropertyMessage('reports-summary-message');

            try {
                const month = monthInput.value || getLocalDateString().slice(0, 7);
                const [year, monthNumber] = month.split('-').map(Number);
                if (!year || !monthNumber || monthNumber > 12) throw new Error(i18n[currentLang].reports_load_error);
                const monthStart = `${month}-01`;
                const nextMonthDate = new Date(Date.UTC(year, monthNumber, 1));
                const nextMonth = `${nextMonthDate.getUTCFullYear()}-${String(nextMonthDate.getUTCMonth() + 1).padStart(2, '0')}-01`;
                const selectedProperty = filterPropertySelect.value;
                let entriesQuery = supabaseClient
                    .from('property_financial_entries')
                    .select('id, property_id, entry_type, amount, description, occurred_on, status')
                    .eq('user_id', currentUser.id)
                    .gte('occurred_on', monthStart)
                    .lt('occurred_on', nextMonth)
                    .order('occurred_on', { ascending: false });
                if (selectedProperty && selectedProperty !== 'all') {
                    entriesQuery = entriesQuery.eq('property_id', selectedProperty);
                }

                const [propertiesResult, entriesResult, tasksResult] = await Promise.all([
                    supabaseClient.from('properties').select('id, name').eq('user_id', currentUser.id).order('name'),
                    entriesQuery,
                    supabaseClient
                        .from('cleaning_tasks')
                        .select('property_id, properties!inner(user_id)')
                        .eq('properties.user_id', currentUser.id)
                ]);
                if (requestId !== reportsRequestId) return;
                if (propertiesResult.error) throw propertiesResult.error;
                const properties = propertiesResult.data || [];
                const selectedFilterValue = filterPropertySelect.value;
                filterPropertySelect.replaceChildren(
                    new Option(i18n[currentLang].opt_all_properties, 'all'),
                    ...properties.map(property => new Option(property.name, property.id))
                );
                filterPropertySelect.value = properties.some(property => String(property.id) === selectedFilterValue)
                    ? selectedFilterValue
                    : 'all';

                if (propertySelect) {
                    const selectedId = propertySelect.value;
                    const hostingPropertySelect = document.getElementById('hosting-report-property');
                    const selectedHostingPropertyId = hostingPropertySelect.value;
                    propertySelect.replaceChildren(
                        new Option(i18n[currentLang].reports_select_property, ''),
                        ...properties.map(property => new Option(property.name, property.id))
                    );
                    if (properties.some(property => String(property.id) === selectedId)) {
                        propertySelect.value = selectedId;
                    }
                    propertySelect.disabled = properties.length === 0;
                    document.getElementById('financial-entry-submit').disabled = properties.length === 0;
                    hostingPropertySelect.replaceChildren(
                        new Option(i18n[currentLang].hosting_no_property, ''),
                        ...properties.map(property => new Option(property.name, property.id))
                    );
                    if (properties.some(property => String(property.id) === selectedHostingPropertyId)) {
                        hostingPropertySelect.value = selectedHostingPropertyId;
                    } else {
                        hostingPropertySelect.value = '';
                    }
                    hostingPropertySelect.disabled = false;
                    document.getElementById('hosting-report-submit').disabled = false;
                }

                if (entriesResult.error) throw entriesResult.error;
                if (tasksResult.error) throw tasksResult.error;
                const entries = entriesResult.data || [];
                const tasks = tasksResult.data || [];
                const propertiesById = new Map(properties.map(property => [String(property.id), property]));
                const metricsByProperty = new Map(properties.map(property => [String(property.id), {
                    property,
                    income: 0,
                    expenses: 0,
                    cleanings: 0
                }]));
                entries.forEach(entry => {
                    const metric = metricsByProperty.get(String(entry.property_id));
                    if (!metric) return;
                    if (entry.entry_type === 'income') metric.income += Number(entry.amount);
                    else if (entry.entry_type === 'expense') metric.expenses += Number(entry.amount);
                });
                tasks.forEach(task => {
                    const metric = metricsByProperty.get(String(task.property_id));
                    if (metric) metric.cleanings += 1;
                });
                const propertyMetrics = [...metricsByProperty.values()].filter(metric =>
                    !selectedProperty || selectedProperty === 'all' || String(metric.property.id) === selectedProperty
                );
                const mostRequested = [...metricsByProperty.values()].reduce((top, metric) =>
                    metric.cleanings > (top?.cleanings || 0) ? metric : top, null);
                const totals = entries.reduce((sum, entry) => {
                    if (entry.entry_type === 'income') sum.income += Number(entry.amount);
                    else if (entry.entry_type === 'expense') sum.expenses += Number(entry.amount);
                    return sum;
                }, { income: 0, expenses: 0 });
                cardsEl.innerHTML = `
                    <article class="rounded-2xl border border-emerald-900/80 bg-emerald-950/60 p-4">
                        <p class="text-[10px] font-bold uppercase tracking-wide text-emerald-300">${i18n[currentLang].finance_metric_month_income}</p>
                        <p class="mt-2 text-xl font-extrabold text-emerald-100">${formatFinancialAmount(totals.income)}</p>
                    </article>
                    <article class="rounded-2xl border border-rose-900/80 bg-rose-950/40 p-4">
                        <p class="text-[10px] font-bold uppercase tracking-wide text-rose-300">${i18n[currentLang].finance_metric_expenses}</p>
                        <p class="mt-2 text-xl font-extrabold text-rose-100">${formatFinancialAmount(totals.expenses)}</p>
                    </article>
                    <article class="rounded-2xl border border-emerald-400/50 bg-emerald-900/70 p-4 shadow-lg shadow-emerald-950/30">
                        <p class="text-[10px] font-bold uppercase tracking-wide text-emerald-200">${i18n[currentLang].reports_net_total}</p>
                        <p class="mt-2 text-xl font-extrabold text-white">${formatFinancialAmount(totals.income - totals.expenses)}</p>
                    </article>
                `;

                propertyListEl.innerHTML = `
                    ${mostRequested?.cleanings ? `
                        <article class="rounded-xl border border-amber-900/80 bg-amber-950/30 p-3 sm:col-span-2">
                            <p class="text-[9px] font-bold uppercase tracking-wide text-amber-300">${i18n[currentLang].reports_most_requested}</p>
                            <p class="mt-1 text-xs font-extrabold text-white">${escapePropertyHTML(mostRequested.property.name)} <span class="font-medium text-slate-400">· ${mostRequested.cleanings} ${i18n[currentLang].reports_cleanings_count}</span></p>
                        </article>
                    ` : ''}
                    ${propertyMetrics.map(metric => `
                        <article class="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                            <h5 class="truncate text-xs font-bold text-white">${escapePropertyHTML(metric.property.name)}</h5>
                            <div class="mt-2 grid grid-cols-2 gap-2 text-[10px]">
                                <span class="text-emerald-300">${i18n[currentLang].reports_income_total}: <strong>${formatFinancialAmount(metric.income)}</strong></span>
                                <span class="text-rose-300">${i18n[currentLang].reports_expense_total}: <strong>${formatFinancialAmount(metric.expenses)}</strong></span>
                                <span class="col-span-2 text-slate-400">${metric.cleanings} ${i18n[currentLang].reports_cleanings_count}</span>
                            </div>
                        </article>
                    `).join('')}
                `;
            } catch (error) {
                if (requestId !== reportsRequestId) return;
                console.error('Erro ao carregar métricas financeiras:', error);
                cardsEl.innerHTML = `<p class="text-rose-300 text-xs">${i18n[currentLang].reports_load_error}</p>`;
                propertyListEl.replaceChildren();
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
            const category = document.getElementById('financial-category').value.trim();
            const description = document.getElementById('financial-description').value.trim();
            const occurredOn = document.getElementById('financial-date').value;
            if (!propertyId || !['income', 'expense'].includes(entryType) || !Number.isFinite(amount) || amount <= 0 || !description || !category || !occurredOn) {
                showPropertyMessage('financial-entry-message', i18n[currentLang].reports_invalid_entry, 'error');
                return;
            }

            const submitButton = document.getElementById('financial-entry-submit');
            submitButton.disabled = true;
            hidePropertyMessage('financial-entry-message');
            try {
                const entryRow = {
                    property_id: propertyId,
                    user_id: currentUser.id,
                    entry_type: entryType,
                    category,
                    amount,
                    description,
                    entry_date: occurredOn,
                    occurred_on: occurredOn,
                    status: 'paid'
                };
                const { error } = await supabaseClient
                    .from('property_financial_entries')
                    .insert([entryRow]);
                if (error) throw error;

                document.getElementById('financial-entry-form').reset();
                document.getElementById('financial-date').value = getLocalDateString();
                await carregarRelatorios();
                await Promise.all([carregarLancamentosManuais(), renderFinancialChart()]);
                showPropertyMessage('financial-entry-message', i18n[currentLang].reports_entry_success, 'success');
            } catch (error) {
                console.error('Erro ao registar movimento financeiro:', error);
                showPropertyMessage('financial-entry-message', `${i18n[currentLang].reports_entry_error}: ${error.message}`, 'error');
            } finally {
                submitButton.disabled = false;
            }
        }

        async function carregarLancamentosManuais() {
            const tbody = document.getElementById('financial-entries-table-body');
            if (!tbody || !currentUser || userRole !== 'admin') return;
            tbody.innerHTML = `<tr><td colspan="6" class="px-2 py-3 text-slate-400">${i18n[currentLang].financial_entries_loading}</td></tr>`;
            try {
                const { data, error } = await supabaseClient
                    .from('property_financial_entries')
                    .select('id, property_id, entry_type, amount, description, category, entry_date, occurred_on, created_at, properties(name)')
                    .eq('user_id', currentUser.id)
                    .order('occurred_on', { ascending: false })
                    .order('created_at', { ascending: false })
                    .limit(50);
                if (error) throw error;
                if (!data?.length) {
                    tbody.innerHTML = `<tr><td colspan="6" class="px-2 py-3 text-slate-400">${i18n[currentLang].financial_entries_empty}</td></tr>`;
                    return;
                }
                tbody.innerHTML = data.map(entry => {
                    const income = entry.entry_type === 'income';
                    const entryDate = entry.entry_date ?? entry.occurred_on ?? '';
                    return `
                        <tr>
                            <td class="whitespace-nowrap px-2 py-2">${escapePropertyHTML(entryDate)}</td>
                            <td class="max-w-40 truncate px-2 py-2">${escapePropertyHTML(entry.properties?.name || '')}</td>
                            <td class="px-2 py-2"><span class="${income ? 'text-emerald-300' : 'text-rose-300'}">${income ? 'Receita' : 'Despesa'}</span></td>
                            <td class="px-2 py-2">${escapePropertyHTML(entry.category || 'Geral')}</td>
                            <td class="max-w-52 truncate px-2 py-2" title="${escapePropertyHTML(entry.description)}">${escapePropertyHTML(entry.description)}</td>
                            <td class="whitespace-nowrap px-2 py-2 text-right font-semibold ${income ? 'text-emerald-300' : 'text-rose-300'}">${income ? '+' : '−'}${formatFinancialAmount(Number(entry.amount))}</td>
                        </tr>
                    `;
                }).join('');
            } catch (error) {
                console.error('Erro ao carregar lançamentos financeiros:', error);
                tbody.innerHTML = `<tr><td colspan="6" class="px-2 py-3 text-rose-300">${i18n[currentLang].financial_entries_error}: ${escapePropertyHTML(error.message)}</td></tr>`;
            }
        }

        function validateHostingReportFile(file) {
            if (!file) return false;
            const extension = file.name.split('.').pop()?.toLowerCase();
            return file.size > 0
                && file.size <= 20 * 1024 * 1024
                && ['pdf', 'csv'].includes(extension);
        }

        async function extractTextFromPDF(file) {
            if (!window.pdfjsLib) throw new Error('A biblioteca PDF.js não foi carregada.');
            const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
            const pages = [];

            for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
                const { items } = await (await pdf.getPage(pageNumber)).getTextContent();
                const positionedItems = items.filter(item => item.str?.trim() && item.transform?.length >= 6);
                const lines = [];

                if (positionedItems.length !== items.filter(item => item.str?.trim()).length) {
                    pages.push(items.map(item => item.str || '').join(' '));
                    continue;
                }

                positionedItems.forEach(item => {
                    const x = item.transform[4];
                    const y = item.transform[5];
                    let line = lines.find(candidate => Math.abs(candidate.y - y) <= 2.5);
                    if (!line) {
                        line = { y, items: [] };
                        lines.push(line);
                    }
                    line.items.push({ x, text: item.str });
                });

                pages.push(lines
                    .sort((a, b) => b.y - a.y)
                    .map(line => line.items
                        .sort((a, b) => a.x - b.x)
                        .map(item => item.text)
                        .join(' ')
                        .replace(/\s+/g, ' ')
                        .trim())
                    .filter(Boolean)
                    .join('\n'));
            }

            const text = pages.join('\n').trim();
            if (!text) throw new Error('Não foi possível extrair texto deste PDF.');
            return text;
        }

        function normalizeAirbnbText(value) {
            return String(value || '')
                .trim()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        }

        function propertyNameMatchScore(text, propertyName) {
            const normalizedText = normalizeAirbnbText(text);
            const normalizedName = normalizeAirbnbText(propertyName);
            if (!normalizedText || !normalizedName) return 0;
            if (normalizedText.includes(normalizedName) || normalizedName.includes(normalizedText)) {
                return 2 + normalizedName.length / 1000;
            }

            const ignoredWords = new Set(['a', 'an', 'and', 'da', 'das', 'de', 'do', 'dos', 'e', 'of', 'the']);
            const nameTokens = normalizedName.split(' ').filter(token => token && !ignoredWords.has(token));
            const textTokens = normalizedText.split(' ').filter(token => token);
            if (!nameTokens.length || !textTokens.length) return 0;

            let matchedTokens = 0;
            for (const nameToken of nameTokens) {
                const matched = textTokens.some(textToken =>
                    textToken === nameToken
                    || (nameToken.length >= 4
                        && textToken.length >= 4
                        && levenshteinDistanceAtMostOne(nameToken, textToken))
                );
                if (matched) matchedTokens += 1;
            }

            const minimumMatches = nameTokens.length === 1 ? 1 : 2;
            const coverage = matchedTokens / nameTokens.length;
            if (matchedTokens < minimumMatches || coverage < 0.5) return 0;
            return coverage + Math.min(normalizedName.length, 100) / 10000;
        }

        function levenshteinDistanceAtMostOne(first, second) {
            if (Math.abs(first.length - second.length) > 1) return false;
            let firstIndex = 0;
            let secondIndex = 0;
            let edits = 0;
            while (firstIndex < first.length && secondIndex < second.length) {
                if (first[firstIndex] === second[secondIndex]) {
                    firstIndex += 1;
                    secondIndex += 1;
                    continue;
                }
                edits += 1;
                if (edits > 1) return false;
                if (first.length > second.length) firstIndex += 1;
                else if (second.length > first.length) secondIndex += 1;
                else {
                    firstIndex += 1;
                    secondIndex += 1;
                }
            }
            if (firstIndex < first.length || secondIndex < second.length) edits += 1;
            return edits <= 1;
        }

        function findPropertyInPDFLines(lines, index, properties) {
            const findMatches = text => properties
                .map(property => ({ property, score: propertyNameMatchScore(text, property.name) }))
                .filter(match => match.score > 0)
                .sort((a, b) => b.score - a.score);
            const resolveMatch = matches => {
                if (!matches.length) return null;
                const topMatches = matches.filter(match => Math.abs(match.score - matches[0].score) < 0.00001);
                return new Set(topMatches.map(match => String(match.property.id))).size === 1
                    ? matches[0].property
                    : null;
            };
            const currentLineMatch = resolveMatch(findMatches(lines[index]));
            if (currentLineMatch) return currentLineMatch;
            if (lines[index + 1] && resolveMatch(findMatches(lines[index + 1]))) return null;

            const matches = findMatches([lines[index], lines[index + 1]].filter(Boolean).join(' '));
            return resolveMatch(matches);
        }

        function collectPropertyRows(lines, properties) {
            const rows = [];
            lines.forEach((line, index) => {
                const property = findPropertyInPDFLines(lines, index, properties);
                if (!property) return;
                const previousRow = rows[rows.length - 1];
                if (previousRow
                    && String(previousRow.property.id) === String(property.id)
                    && index - previousRow.index <= 1) return;
                rows.push({ index, property });
            });
            return rows;
        }

        function findBestPropertyForReportText(text, properties, forcedProperty = null) {
            const normalizedText = normalizeAirbnbText(text);
            if (!normalizedText && forcedProperty) return forcedProperty;
            const scoredProperties = (properties || [])
                .map(property => ({ property, score: propertyNameMatchScore(normalizedText, property.name) }))
                .filter(match => match.score > 0)
                .sort((a, b) => b.score - a.score);
            if (scoredProperties.length) return scoredProperties[0].property;
            return forcedProperty || null;
        }

        function parseAirbnbPdfDate(value) {
            const match = value.match(/\b(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})\b|\b(\d{4})-(\d{2})-(\d{2})\b/);
            if (!match) return null;
            const [, day, month, year, isoYear, isoMonth, isoDay] = match;
            const parsedYear = Number(isoYear || year);
            const parsedMonth = Number(isoMonth || month);
            const parsedDay = Number(isoDay || day);
            const parsedDate = new Date(Date.UTC(parsedYear, parsedMonth - 1, parsedDay));
            if (parsedDate.getUTCFullYear() !== parsedYear
                || parsedDate.getUTCMonth() !== parsedMonth - 1
                || parsedDate.getUTCDate() !== parsedDay) return null;
            return `${parsedYear}-${String(parsedMonth).padStart(2, '0')}-${String(parsedDay).padStart(2, '0')}`;
        }

        function resolvePlatformReportDate(lines, fallbackDate = null) {
            const text = (lines || []).join(' ');
            const monthNameMap = {
                jan: 1, january: 1, janeiro: 1,
                feb: 2, february: 2, fevereiro: 2,
                mar: 3, march: 3, marco: 3, março: 3,
                apr: 4, april: 4, abril: 4,
                may: 5, maio: 5,
                jun: 6, june: 6, junho: 6,
                jul: 7, july: 7, julho: 7,
                aug: 8, august: 8, agosto: 8,
                sep: 9, sept: 9, september: 9, setembro: 9,
                oct: 10, october: 10, outubro: 10,
                nov: 11, november: 11, novembro: 11,
                dec: 12, december: 12, dezembro: 12
            };

            const monthNameMatch = [...text.matchAll(/\b([a-zA-ZÀ-ÿ]+)\s*(?:de)?\s*(\d{4})\b/g)]
                .map(match => {
                    const monthKey = match[1].trim().toLowerCase();
                    const monthNumber = monthNameMap[monthKey];
                    if (!monthNumber) return null;
                    return { monthNumber, year: Number(match[2]) };
                })
                .find(Boolean);
            if (monthNameMatch) {
                return `${monthNameMatch.year}-${String(monthNameMatch.monthNumber).padStart(2, '0')}-01`;
            }

            const candidateDates = [...text.matchAll(/\b(?:\d{1,2}[/. -]\d{1,2}[/. -]\d{4}|\d{4}-\d{2}-\d{2})\b/g)]
                .map(match => parseAirbnbPdfDate(match[0]))
                .filter(Boolean)
                .sort();

            if (candidateDates.length) return candidateDates[0];
            return fallbackDate || getLocalDateString();
        }

        function extractEuroAmounts(text) {
            const pattern = /(?:€|EUR)\s*([+-]?\d[\d.,\u00a0 ]*)|([+-]?\d[\d.,\u00a0 ]*)\s*(?:€|EUR)(?![A-Za-z])/gi;
            return [...text.matchAll(pattern)].map(match => {
                let value = (match[1] || match[2]).replace(/[ \u00a0]/g, '');
                const lastComma = value.lastIndexOf(',');
                const lastDot = value.lastIndexOf('.');
                const decimalIndex = Math.max(lastComma, lastDot);
                const decimalPlaces = decimalIndex < 0 ? 0 : value.length - decimalIndex - 1;
                if (decimalPlaces >= 1 && decimalPlaces <= 2) {
                    value = `${value.slice(0, decimalIndex).replace(/[.,]/g, '')}.${value.slice(decimalIndex + 1)}`;
                } else {
                    value = value.replace(/[.,]/g, '');
                }
                return Number(value);
            }).filter(value => Number.isFinite(value) && value > 0);
        }

        async function persistPlatformEarnings(platformName, earnings) {
            if (!earnings.length) return { matched: 0, inserted: 0, duplicates: 0 };
            const dates = earnings.map(earning => earning.occurred_on).sort();
            const { data: existingEntries, error: existingError } = await supabaseClient
                .from('property_financial_entries')
                .select('property_id, amount, description, occurred_on')
                .eq('user_id', currentUser.id)
                .eq('entry_type', 'income')
                .like('description', `${platformName}:%`)
                .gte('occurred_on', dates[0])
                .lte('occurred_on', dates[dates.length - 1]);
            if (existingError) throw existingError;

            const existingKeys = new Set((existingEntries || []).map(entry =>
                `${entry.property_id}|${entry.occurred_on}|${entry.description}|${Number(entry.amount).toFixed(2)}`
            ));
            const newEntries = [];
            let duplicates = 0;
            earnings.forEach(earning => {
                const key = `${earning.property_id}|${earning.occurred_on}|${earning.description}|${Number(earning.amount).toFixed(2)}`;
                if (existingKeys.has(key)) {
                    duplicates += 1;
                    return;
                }
                existingKeys.add(key);
                newEntries.push({
                    ...earning,
                    user_id: currentUser.id,
                    entry_date: earning.occurred_on,
                    occurred_on: earning.occurred_on,
                    status: 'paid'
                });
            });

            if (newEntries.length) {
                const { error: insertError } = await supabaseClient
                    .from('property_financial_entries')
                    .insert(newEntries);
                if (insertError) throw insertError;
            }
            return { matched: earnings.length, inserted: newEntries.length, duplicates };
        }

        async function processAirbnbPDF(file, properties, forcedPropertyId = null) {
            const text = await extractTextFromPDF(file);
            const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
            const selectedProperty = forcedPropertyId ? (properties || []).find(property => String(property?.id) === String(forcedPropertyId)) : null;
            const validProperties = (properties || [])
                .filter(property => property?.id && property?.name)
                .filter(property => normalizeAirbnbText(property.name).length >= 3);
            const fallbackProperty = selectedProperty || validProperties[0] || null;
            const propertyRows = selectedProperty
                ? [{ index: 0, property: selectedProperty }]
                : collectPropertyRows(lines, validProperties);

            const earnings = [];
            for (let rowIndex = 0; rowIndex < propertyRows.length; rowIndex += 1) {
                const row = propertyRows[rowIndex];
                const nextRow = propertyRows[rowIndex + 1];
                const blockEnd = Math.min(nextRow?.index ?? lines.length, row.index + 30);
                const block = lines.slice(row.index, blockEnd);
                const datePositions = [];
                block.forEach((line, lineIndex) => {
                    const datePattern = /\b(?:\d{1,2}[/. -]\d{1,2}[/. -]\d{4}|\d{4}-\d{2}-\d{2})\b/g;
                    for (const match of line.matchAll(datePattern)) {
                        const occurredOn = parseAirbnbPdfDate(match[0]);
                        if (occurredOn) datePositions.push({ lineIndex, index: match.index, length: match[0].length, occurredOn });
                    }
                });

                const resolvedProperty = row.property || findBestPropertyForReportText(block.join(' '), validProperties, fallbackProperty);
                if (!resolvedProperty) continue;

                for (let dateIndex = 0; dateIndex < datePositions.length; dateIndex += 1) {
                    const date = datePositions[dateIndex];
                    const nextDate = datePositions[dateIndex + 1];
                    const amountText = [];
                    const lastLineIndex = nextDate?.lineIndex ?? block.length - 1;
                    for (let lineIndex = date.lineIndex; lineIndex <= lastLineIndex; lineIndex += 1) {
                        let line = block[lineIndex];
                        if (lineIndex === date.lineIndex) line = line.slice(date.index + date.length);
                        if (nextDate && lineIndex === nextDate.lineIndex) line = line.slice(0, nextDate.index);
                        amountText.push(line);
                        if (extractEuroAmounts(line).length) break;
                    }
                    const amounts = extractEuroAmounts(amountText.join(' '));
                    const amount = amounts[amounts.length - 1];
                    if (!amount) continue;

                    const transactionText = block
                        .slice(Math.max(0, date.lineIndex - 2), date.lineIndex + 1)
                        .join(' ');
                    const transactionMatch = transactionText.match(/\b(?:pagamento(?:\s+de\s+alojamento)?|payment|payout|ajuste|adjustment|reembolso|refund)\b[^|·]*/i);
                    const transactionType = transactionMatch?.[0]?.trim() || 'Rendimento';
                    earnings.push({
                        property_id: resolvedProperty.id,
                        entry_type: 'income',
                        category: 'Ganhos',
                        amount: Math.round(amount * 100) / 100,
                        description: `Airbnb: ${transactionType}`.slice(0, 200),
                        occurred_on: date.occurredOn,
                        status: 'paid'
                    });
                }
            }

            if (!earnings.length && fallbackProperty) {
                const fallbackAmount = extractEuroAmounts(lines.join(' ')).slice(-1)[0];
                if (fallbackAmount) {
                    earnings.push({
                        property_id: fallbackProperty.id,
                        entry_type: 'income',
                        category: 'Ganhos',
                        amount: Math.round(fallbackAmount * 100) / 100,
                        description: 'Airbnb: Relatório global',
                        occurred_on: resolvePlatformReportDate(lines, getLocalDateString()),
                        status: 'paid'
                    });
                }
            }

            return persistPlatformEarnings('Airbnb', earnings);
        }

        async function processBookingPDF(file, properties, forcedPropertyId = null) {
            const text = await extractTextFromPDF(file);
            const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
            const selectedProperty = forcedPropertyId ? (properties || []).find(property => String(property?.id) === String(forcedPropertyId)) : null;
            const validProperties = (properties || [])
                .filter(property => property?.id && property?.name)
                .filter(property => normalizeAirbnbText(property.name).length >= 3);
            const fallbackProperty = selectedProperty || validProperties[0] || null;
            const propertyRows = selectedProperty
                ? [{ index: 0, property: selectedProperty }]
                : collectPropertyRows(lines, validProperties);

            const totalsByProperty = new Map();
            const transactionPattern = /\b(?:reservation|booking|confirmation|payment|payout|paid|net(?:\s+amount)?|gross|total|amount|valor|montante|reserva|pagamento|liquido|liquida)\b/i;
            const excludedAmountPattern = /\b(?:commission|fee|tax|vat|comissao|taxa|imposto)\b/i;
            const reservationIdPattern = /\b(?:reservation|booking|confirmation|reserva)\s*(?:no\.?|number|id|n[ºo.]?)?\s*[:#-]?\s*([a-z0-9-]{5,})\b/i;

            for (let rowIndex = 0; rowIndex < propertyRows.length; rowIndex += 1) {
                const row = propertyRows[rowIndex];
                const blockEnd = propertyRows[rowIndex + 1]?.index ?? lines.length;
                const block = lines.slice(row.index, blockEnd);
                const candidates = new Map();
                let latestDate = null;
                const resolvedProperty = row.property || findBestPropertyForReportText(block.join(' '), validProperties, fallbackProperty);
                if (!resolvedProperty) continue;

                block.forEach((line, lineIndex) => {
                    const dateMatch = line.match(/\b(?:\d{1,2}[/. -]\d{1,2}[/. -]\d{4}|\d{4}-\d{2}-\d{2})\b/);
                    if (dateMatch) {
                        const parsedDate = parseAirbnbPdfDate(dateMatch[0]);
                        if (parsedDate && (!latestDate || parsedDate > latestDate)) latestDate = parsedDate;
                    }

                    const amounts = extractEuroAmounts(line);
                    const netAmountPattern = /\b(?:net|payout|paid|payment|amount due|a pagar|liquido|liquida)\b/i;
                    if (!amounts.length || (excludedAmountPattern.test(line) && !netAmountPattern.test(line))) return;
                    const isPropertyRow = lineIndex === 0;
                    const hasReservationId = reservationIdPattern.test(line);
                    if (!isPropertyRow && !hasReservationId && !transactionPattern.test(line)) return;

                    const reservationId = line.match(reservationIdPattern)?.[1]?.toLowerCase();
                    const candidateKey = reservationId || `${lineIndex}:${normalizeAirbnbText(line)}`;
                    const priority = netAmountPattern.test(line) ? 3 : /\b(?:gross|reservation|booking|reserva)\b/i.test(line) ? 2 : 1;
                    const candidate = { amount: amounts[amounts.length - 1], priority };
                    const existing = candidates.get(candidateKey);
                    if (!existing || candidate.priority >= existing.priority) candidates.set(candidateKey, candidate);
                });

                if (!candidates.size) continue;
                const amount = Math.round([...candidates.values()].reduce((sum, candidate) => sum + candidate.amount, 0) * 100) / 100;
                if (amount <= 0) continue;
                const existing = totalsByProperty.get(resolvedProperty.id);
                if (existing) {
                    existing.amount = Math.round((existing.amount + amount) * 100) / 100;
                    if (latestDate && (!existing.occurred_on || latestDate > existing.occurred_on)) {
                        existing.occurred_on = latestDate;
                    }
                } else {
                    totalsByProperty.set(resolvedProperty.id, {
                        property_id: resolvedProperty.id,
                        entry_type: 'income',
                        category: 'Ganhos',
                        amount,
                        description: 'Booking.com: Reservas consolidadas',
                        occurred_on: latestDate || resolvePlatformReportDate(block, getLocalDateString()),
                        status: 'paid'
                    });
                }
            }

            if (!totalsByProperty.size && fallbackProperty) {
                const fallbackAmount = extractEuroAmounts(lines.join(' ')).slice(-1)[0];
                if (fallbackAmount) {
                    totalsByProperty.set(fallbackProperty.id, {
                        property_id: fallbackProperty.id,
                        entry_type: 'income',
                        category: 'Ganhos',
                        amount: Math.round(fallbackAmount * 100) / 100,
                        description: 'Booking.com: Relatório global',
                        occurred_on: resolvePlatformReportDate(lines, getLocalDateString()),
                        status: 'paid'
                    });
                }
            }

            return persistPlatformEarnings('Booking.com', [...totalsByProperty.values()]);
        }

        function carregarPropriedadesDocumentos() {
            const propertySelect = document.getElementById('hosting-report-property');
            if (!propertySelect) return;
            const selectedPropertyId = propertySelect.value;
            propertySelect.replaceChildren(
                new Option(i18n[currentLang].hosting_no_property, ''),
                ...allPropertiesCache.map(property => new Option(property.name, property.id))
            );
            propertySelect.value = allPropertiesCache.some(property => String(property.id) === selectedPropertyId)
                ? selectedPropertyId
                : '';
        }

        async function submitHostingReport(event) {
            event.preventDefault();
            if (!currentUser || userRole !== 'admin') {
                showPropertyMessage('hosting-report-message', i18n[currentLang].role_locked, 'error');
                return;
            }
            const propertyId = document.getElementById('hosting-report-property').value || null;
            const platformName = document.getElementById('hosting-report-platform').value.trim();
            const file = document.getElementById('hosting-report-file').files?.[0];
            if (!platformName || !validateHostingReportFile(file)) {
                showPropertyMessage('hosting-report-message', i18n[currentLang].hosting_file_required, 'error');
                return;
            }

            const submitButton = document.getElementById('hosting-report-submit');
            submitButton.disabled = true;
            submitButton.innerText = i18n[currentLang].hosting_uploading;
            hidePropertyMessage('hosting-report-message');
            const safeFileName = file.name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(-120);
            const extension = safeFileName.split('.').pop().toLowerCase();
            const documentId = crypto.randomUUID();
            let storage;
            let storagePath;
            try {
                const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
                if (userError) throw userError;
                if (!user?.id) throw new Error('É necessário iniciar sessão para carregar documentos.');

                storagePath = `${user.id}/${propertyId || 'unassigned'}/${documentId}.${extension}`;
                storage = supabaseClient.storage.from('platform-documents');
                const { error: uploadError } = await storage.upload(storagePath, file, {
                    contentType: extension === 'pdf' ? 'application/pdf' : 'text/csv',
                    upsert: false
                });
                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = storage.getPublicUrl(storagePath);
                const documentRecord = {
                    platform: platformName,
                    file_url: publicUrl,
                    file_name: safeFileName,
                    property_id: propertyId,
                    ...(user?.id ? { user_id: user.id } : {})
                };
                const { error: insertError } = await supabaseClient
                    .from('platform_documents')
                    .insert([documentRecord]);
                if (insertError) {
                    const { error: cleanupError } = await storage.remove([storagePath]);
                    if (cleanupError) {
                        console.error('O ficheiro carregado não pôde ser removido após falha ao guardar o registo:', cleanupError);
                        throw new Error(`${insertError.message}; ${cleanupError.message}`);
                    }
                    throw insertError;
                }

                let platformImportResult = null;
                let platformImportError = null;
                const normalizedPlatformName = platformName.toLowerCase();
                if (['airbnb', 'booking.com'].includes(normalizedPlatformName) && file.type === 'application/pdf') {
                    try {
                        const { data: properties, error: propertiesError } = await supabaseClient
                            .from('properties')
                            .select('id, name')
                            .eq('user_id', user.id);
                        if (propertiesError) throw propertiesError;
                        if (normalizedPlatformName === 'airbnb') {
                            platformImportResult = await processAirbnbPDF(file, properties || [], propertyId);
                        } else {
                            platformImportResult = await processBookingPDF(file, properties || [], propertyId);
                        }
                    } catch (error) {
                        platformImportError = error;
                        console.error(`Erro ao importar ganhos do relatório ${platformName}:`, error);
                    }
                }

                const selectedProperty = propertyId || '';
                document.getElementById('hosting-report-form').reset();
                document.getElementById('hosting-report-property').value = selectedProperty;
                document.getElementById('hosting-report-file-label').innerText = i18n[currentLang].hosting_choose_file;
                await carregarDocumentosHosting();
                if (platformImportResult) {
                    await Promise.all([
                        carregarLancamentosManuais(),
                        carregarRelatorios(),
                        renderFinancialChart()
                    ]);
                }
                const importMessagePrefix = normalizedPlatformName === 'booking.com' ? 'hosting_booking_import' : 'hosting_airbnb_import';
                if (platformImportError) {
                    showPropertyMessage(
                        'hosting-report-message',
                        `${i18n[currentLang][`${importMessagePrefix}_error`]}: ${platformImportError.message}`,
                        'error'
                    );
                } else if (platformImportResult?.matched === 0 && platformImportResult?.inserted === 0) {
                    showPropertyMessage('hosting-report-message', i18n[currentLang][`${importMessagePrefix}_none`], 'success');
                } else if (platformImportResult) {
                    showPropertyMessage(
                        'hosting-report-message',
                        i18n[currentLang][`${importMessagePrefix}_success`]
                            .replace('{count}', String(platformImportResult.inserted))
                            .replace('{duplicates}', String(platformImportResult.duplicates)),
                        'success'
                    );
                } else {
                    showPropertyMessage('hosting-report-message', i18n[currentLang].hosting_upload_success, 'success');
                }
            } catch (err) {
                console.error('Erro ao carregar o documento da plataforma:', err);
                console.log(err);
                showPropertyMessage('hosting-report-message', `${i18n[currentLang].hosting_upload_error}: ${err.message}`, 'error');
            } finally {
                submitButton.disabled = false;
                submitButton.innerText = i18n[currentLang].hosting_upload;
            }
        }

        function getPlatformDocumentStoragePath(fileUrl) {
            const publicUrl = new URL(fileUrl);
            const supabaseOrigin = new URL(SUPABASE_URL).origin;
            const publicPathPrefix = '/storage/v1/object/public/platform-documents/';
            if (publicUrl.origin !== supabaseOrigin || !publicUrl.pathname.startsWith(publicPathPrefix)) {
                throw new Error('O URL do documento não corresponde ao bucket platform-documents.');
            }
            return decodeURIComponent(publicUrl.pathname.slice(publicPathPrefix.length));
        }

        async function carregarDocumentosHosting() {
            const listEl = document.getElementById('hosting-reports-list');
            if (!listEl || !currentUser || userRole !== 'admin') return;
            const requestId = ++hostingReportsRequestId;
            listEl.innerHTML = `<p class="text-xs text-slate-400">${i18n[currentLang].reports_loading}</p>`;
            try {
                const { data, error } = await supabaseClient
                    .from('platform_documents')
                    .select('id, property_id, platform, file_name, file_url, created_at')
                    .order('created_at', { ascending: false });
                if (error) throw error;
                if (requestId !== hostingReportsRequestId) return;
                hostingReportsCache = data || [];
                if (!hostingReportsCache.length) {
                    listEl.innerHTML = `<p class="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-400">${i18n[currentLang].hosting_no_documents}</p>`;
                    return;
                }
                const propertyNames = new Map([...document.getElementById('financial-filter-property').options]
                    .map(option => [String(option.value), option.textContent]));
                listEl.innerHTML = hostingReportsCache.map(report => {
                    const uploadedAt = new Date(report.created_at).toLocaleDateString(
                        currentLang === 'pt' ? 'pt-PT' : 'en-US',
                        { day: '2-digit', month: 'short', year: 'numeric' }
                    );
                    return `
                        <article class="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3 sm:flex-row sm:items-center sm:justify-between">
                            <div class="flex min-w-0 items-center gap-3">
                                <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-[10px] font-extrabold uppercase text-indigo-300">${report.file_name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'CSV'}</span>
                                <div class="min-w-0">
                                    <p class="truncate text-xs font-bold text-white">${escapePropertyHTML(report.file_name)}</p>
                                    <p class="mt-1 truncate text-[10px] text-slate-400">${escapePropertyHTML(report.platform)} · ${escapePropertyHTML(report.property_id ? propertyNames.get(String(report.property_id)) || '' : i18n[currentLang].hosting_no_property)} · ${uploadedAt}</p>
                                </div>
                            </div>
                            <div class="flex shrink-0 gap-2">
                                <button type="button" data-hosting-download="${escapePropertyHTML(report.id)}" class="rounded-lg border border-slate-700 px-3 py-2 text-[10px] font-bold text-slate-200 transition hover:border-indigo-400 hover:text-white">${i18n[currentLang].hosting_download}</button>
                                <button type="button" data-hosting-delete="${escapePropertyHTML(report.id)}" class="rounded-lg border border-rose-900 px-3 py-2 text-[10px] font-bold text-rose-300 transition hover:bg-rose-950">${i18n[currentLang].hosting_delete}</button>
                            </div>
                        </article>
                    `;
                }).join('');
                listEl.querySelectorAll('[data-hosting-download]').forEach(button => {
                    button.addEventListener('click', () => void downloadHostingReport(button.dataset.hostingDownload));
                });
                listEl.querySelectorAll('[data-hosting-delete]').forEach(button => {
                    button.addEventListener('click', () => void deleteHostingReport(button.dataset.hostingDelete));
                });
            } catch (error) {
                if (requestId !== hostingReportsRequestId) return;
                console.error('Erro ao carregar documentos das plataformas:', error);
                listEl.innerHTML = `<p role="alert" class="rounded-xl border border-rose-900 bg-rose-950/40 p-3 text-xs text-rose-300">${i18n[currentLang].hosting_upload_error}: ${escapePropertyHTML(error.message)}</p>`;
            }
        }

        async function downloadHostingReport(reportId) {
            if (!requireAdminAction()) return;
            const report = hostingReportsCache.find(item => String(item.id) === String(reportId));
            if (!report) {
                showPropertyMessage('hosting-report-message', i18n[currentLang].hosting_upload_error, 'error');
                return;
            }
            try {
                getPlatformDocumentStoragePath(report.file_url);
                const downloadUrl = new URL(report.file_url);
                downloadUrl.searchParams.set('download', report.file_name);
                const link = document.createElement('a');
                link.href = downloadUrl.toString();
                link.download = report.file_name;
                link.rel = 'noopener';
                document.body.append(link);
                link.click();
                link.remove();
            } catch (error) {
                console.error('Erro ao gerar o descarregamento do documento:', error);
                showPropertyMessage('hosting-report-message', `${i18n[currentLang].hosting_upload_error}: ${error.message}`, 'error');
            }
        }

        async function deleteHostingReport(reportId) {
            if (!requireAdminAction()) return;
            const report = hostingReportsCache.find(item => String(item.id) === String(reportId));
            if (!report || !window.confirm(i18n[currentLang].hosting_delete_confirm)) return;
            try {
                const storagePath = getPlatformDocumentStoragePath(report.file_url);
                const { error: storageError } = await supabaseClient.storage
                    .from('platform-documents')
                    .remove([storagePath]);
                if (storageError) throw storageError;
                const { error: rowError } = await supabaseClient
                    .from('platform_documents')
                    .delete()
                    .eq('id', report.id);
                if (rowError) throw rowError;
                await carregarDocumentosHosting();
            } catch (error) {
                console.error('Erro ao eliminar documento da plataforma:', error);
                showPropertyMessage('hosting-report-message', `${i18n[currentLang].hosting_delete_error}: ${error.message}`, 'error');
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

            if (!editingPropertyId && !(await checkSubscriptionLimit('properties'))) return;

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

        document.addEventListener('keydown', event => {
            if (!taskAwaitingTimeConfirmation) return;
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopImmediatePropagation();
                return;
            }
            if (event.key !== 'Tab') return;

            const modal = document.getElementById('time-confirmation-modal');
            const focusableElements = [...modal.querySelectorAll('input:not(:disabled), button:not(:disabled)')];
            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];
            if (event.shiftKey && document.activeElement === firstElement) {
                event.preventDefault();
                lastElement.focus();
            } else if (!event.shiftKey && document.activeElement === lastElement) {
                event.preventDefault();
                firstElement.focus();
            }
        }, true);

        document.addEventListener('DOMContentLoaded', () => {
            applyThemePreference(localStorage.getItem('host_cleaner_theme') || 'default');
            document.querySelectorAll('[data-financial-date-preset]').forEach(button => {
                button.addEventListener('click', () => applyFinancialDatePreset(button.dataset.financialDatePreset));
            });
            document.getElementById('financial-date-apply')?.addEventListener('click', async () => {
                const message = document.getElementById('financial-date-modal-message');
                const { startDate, endDate } = getFinancialDateModalRange();
                try {
                    validateFinancialDateRange(startDate, endDate);
                    const applied = await renderFinancialChart(startDate, endDate);
                    if (applied) closeFinancialDateModal();
                    else {
                        message.textContent = document.getElementById('financialOverviewChart-error').textContent
                            || 'Não foi possível aplicar o intervalo.';
                        message.className = 'text-xs font-semibold text-rose-600';
                        message.classList.remove('hidden');
                    }
                } catch (error) {
                    message.textContent = error.message;
                    message.className = 'text-xs font-semibold text-rose-600';
                    message.classList.remove('hidden');
                }
            });
            document.getElementById('financial-export-csv')?.addEventListener('click', event => {
                void runFinancialExport(exportToCSV, event.currentTarget);
            });
            document.getElementById('financial-export-pdf')?.addEventListener('click', event => {
                void runFinancialExport(exportToPDF, event.currentTarget);
            });
            document.getElementById('financial-date-modal')?.addEventListener('click', event => {
                if (event.target.id === 'financial-date-modal') closeFinancialDateModal();
            });
            const cancellationPolicyModal = document.getElementById('cancellation-policy-modal');
            cancellationPolicyModal?.addEventListener('click', event => {
                if (event.target === cancellationPolicyModal) closeCancellationPolicyModal();
            });
            document.addEventListener('keydown', event => {
                if (!cancellationPolicyModal || cancellationPolicyModal.classList.contains('hidden')) return;
                if (event.key === 'Escape') {
                    event.preventDefault();
                    closeCancellationPolicyModal();
                    return;
                }
                if (event.key !== 'Tab') return;

                const focusableElements = [...cancellationPolicyModal.querySelectorAll('button:not(:disabled)')];
                const firstElement = focusableElements[0];
                const lastElement = focusableElements[focusableElements.length - 1];
                if (event.shiftKey && document.activeElement === firstElement) {
                    event.preventDefault();
                    lastElement.focus();
                } else if (!event.shiftKey && document.activeElement === lastElement) {
                    event.preventDefault();
                    firstElement.focus();
                }
            });

            const teamAddForm = document.getElementById('team-add-form');
            teamAddForm?.addEventListener('submit', event => {
                event.preventDefault();
                event.stopImmediatePropagation();
                void (async () => {
                    try {
                        if (await checkSubscriptionLimit('cleaners')) {
                            await handleAddTeamMember(event);
                        }
                    } catch (error) {
                        console.error('Erro ao validar o limite de cleaners:', error);
                        alert(`Não foi possível validar o limite de cleaners: ${error.message}`);
                    }
                })();
            }, true);

            document.getElementById('financial-filter-month')?.addEventListener('change', () => void carregarRelatorios());
            document.getElementById('financial-filter-property')?.addEventListener('change', () => void carregarRelatorios());
            document.getElementById('hosting-report-file')?.addEventListener('change', event => {
                const file = event.target.files?.[0];
                if (!file) return;
                document.getElementById('hosting-report-file-label').innerText = file.name;
                if (!validateHostingReportFile(file)) {
                    showPropertyMessage('hosting-report-message', i18n[currentLang].hosting_file_required, 'error');
                    event.target.value = '';
                    document.getElementById('hosting-report-file-label').innerText = i18n[currentLang].hosting_choose_file;
                } else {
                    hidePropertyMessage('hosting-report-message');
                }
            });
            const reportDropzone = document.getElementById('hosting-report-dropzone');
            reportDropzone?.addEventListener('dragover', event => {
                event.preventDefault();
                reportDropzone.classList.add('dragover');
            });
            reportDropzone?.addEventListener('dragleave', event => {
                if (!reportDropzone.contains(event.relatedTarget)) reportDropzone.classList.remove('dragover');
            });
            reportDropzone?.addEventListener('drop', event => {
                event.preventDefault();
                reportDropzone.classList.remove('dragover');
                const file = event.dataTransfer?.files?.[0];
                if (!file) return;
                const fileInput = document.getElementById('hosting-report-file');
                const transfer = new DataTransfer();
                transfer.items.add(file);
                fileInput.files = transfer.files;
                fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            });
            window.addEventListener('online', () => {
                updateIncidentNetworkStatus();
                document.querySelectorAll('.property-incident-history[open]').forEach(details => {
                    delete details.dataset.loaded;
                    void loadPropertyIncidentHistory(details);
                });
                if (!document.getElementById('view-history').classList.contains('hidden')) {
                    void loadGlobalIncidentHistory();
                }
                void resumePendingSync();
            });
            window.addEventListener('offline', () => {
                isOfflineMode = true;
                updateIncidentNetworkStatus();
                void updateOfflineIndicator();
            });
            window.addEventListener('focus', () => {
                if (navigator.onLine) void resumePendingSync();
            });
            window.addEventListener('pageshow', () => {
                if (navigator.onLine) void resumePendingSync();
            });
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible' && navigator.onLine) {
                    void resumePendingSync();
                }
            });
            navigator.connection?.addEventListener?.('change', () => {
                if (navigator.onLine) void resumePendingSync();
                else {
                    isOfflineMode = true;
                    void updateOfflineIndicator();
                }
            });
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.addEventListener('message', event => {
                    if (event.data?.type === 'HOST_CLEANER_SYNC_PENDING') void resumePendingSync();
                });
            }
            void updateOfflineIndicator();
            const searchParams = new URLSearchParams(window.location.search);
            const hash = window.location.hash.toLowerCase();
            const inviteParam = searchParams.get('invite');
            pendingTeamInviteToken = inviteParam && inviteParam.toLowerCase() !== 'true' ? inviteParam : null;
            registrationRole = searchParams.get('role') || 'cleaner';
            registrationRequested = inviteParam?.toLowerCase() === 'true' || hash === '#register';

            initApp().finally(() => {
                document.documentElement.classList.add('app-ready');
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
