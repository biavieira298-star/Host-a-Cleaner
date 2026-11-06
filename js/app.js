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
        let taskAwaitingTimeConfirmation = null;
        let incidentTaskContext = null;
        let incidentRequestId = 0;
        let offlineDatabasePromise = null;
        let syncPendingPromise = null;
        let reportsRequestId = 0;
        let hostingReportsRequestId = 0;
        let hostingReportsCache = [];
        const activeOfflineTaskOperations = new Set();
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
                nav_my_hours: "As Minhas Horas",
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
                incident_type: "Tipo de ocorrência",
                incident_damage: "Dano / Avaria",
                incident_forgotten_item: "Objeto Esquecido",
                incident_description: "Descrição do problema",
                incident_description_placeholder: "Descreva brevemente o que aconteceu",
                incident_photo: "Fotografia (opcional)",
                incident_submit: "Enviar Incidente",
                incident_submitting: "A enviar...",
                incident_saved: "Incidente reportado com sucesso.",
                incident_error: "Não foi possível reportar o incidente",
                incident_photo_error: "Selecione uma imagem até 10 MB.",
                incident_alerts_title: "Alertas Urgentes",
                incident_alerts_loading: "A carregar alertas...",
                incident_alerts_empty: "Sem ocorrências pendentes.",
                incident_alerts_error: "Não foi possível carregar os alertas",
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
                finance_tab_reports: "Relatórios",
                finance_tab_movements: "Movimentos",
                finance_filter_month: "Mês",
                finance_filter_property: "Imóvel",
                finance_transactions: "Transações",
                finance_status: "Estado",
                finance_paid: "Pago",
                finance_pending: "Pendente",
                finance_no_transactions: "Não existem transações para estes filtros.",
                finance_transaction_count: "{count} movimentos",
                finance_service_history: "Histórico de serviços e pagamentos",
                finance_new_entry: "Novo movimento",
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
                hosting_airbnb_import_none: "Documento enviado, mas não foram encontrados ganhos Airbnb associados a imóveis registados.",
                hosting_airbnb_import_error: "Documento enviado, mas não foi possível importar os ganhos Airbnb",
                hosting_booking_import_success: "Documento enviado. Ganhos Booking.com consolidados: {count}; duplicados ignorados: {duplicates}.",
                hosting_booking_import_none: "Documento enviado, mas não foram encontrados ganhos Booking.com associados a imóveis registados.",
                hosting_booking_import_error: "Documento enviado, mas não foi possível importar os ganhos Booking.com",
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
                nav_my_hours: "My Hours",
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
                incident_type: "Incident type",
                incident_damage: "Damage / Fault",
                incident_forgotten_item: "Forgotten Item",
                incident_description: "Problem description",
                incident_description_placeholder: "Briefly describe what happened",
                incident_photo: "Photo (optional)",
                incident_submit: "Submit Incident",
                incident_submitting: "Submitting...",
                incident_saved: "Incident reported successfully.",
                incident_error: "Could not report the incident",
                incident_photo_error: "Select an image up to 10 MB.",
                incident_alerts_title: "Urgent Alerts",
                incident_alerts_loading: "Loading alerts...",
                incident_alerts_empty: "No pending incidents.",
                incident_alerts_error: "Could not load alerts",
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
                finance_tab_reports: "Reports",
                finance_tab_movements: "Movements",
                finance_filter_month: "Month",
                finance_filter_property: "Property",
                finance_transactions: "Transactions",
                finance_status: "Status",
                finance_paid: "Paid",
                finance_pending: "Pending",
                finance_no_transactions: "No transactions match these filters.",
                finance_transaction_count: "{count} entries",
                finance_service_history: "Service and payment history",
                finance_new_entry: "New entry",
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
                hosting_airbnb_import_none: "Document uploaded, but no Airbnb earnings matched registered properties.",
                hosting_airbnb_import_error: "Document uploaded, but Airbnb earnings could not be imported",
                hosting_booking_import_success: "Document uploaded. Booking.com earnings consolidated: {count}; duplicates skipped: {duplicates}.",
                hosting_booking_import_none: "Document uploaded, but no Booking.com earnings matched registered properties.",
                hosting_booking_import_error: "Document uploaded, but Booking.com earnings could not be imported",
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
            document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
                const key = el.getAttribute('data-i18n-aria-label');
                if (i18n[lang] && i18n[lang][key]) el.setAttribute('aria-label', i18n[lang][key]);
            });

            // Re-renderiza o calendário para atualizar os dias da semana
            if (!document.getElementById('view-sub-agenda').classList.contains('hidden')) renderAgendaView();
            if (userRole === 'admin' && !document.getElementById('view-sub-financial-movements').classList.contains('hidden')) {
                fetchHistoryAdmin();
            }
            if (userRole === 'admin' && ['view-sub-reports', 'view-sub-financial-movements'].some(id =>
                !document.getElementById(id).classList.contains('hidden'))) {
                carregarRelatorios();
            }
            if (userRole === 'admin' && !document.getElementById('view-sub-hosting-reports').classList.contains('hidden')) {
                carregarDocumentosHosting();
            }
            void updateOfflineIndicator();
            if (!document.getElementById('view-sub-time-entries').classList.contains('hidden')) {
                carregarRegistosHoras();
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
            window.clearTimeout(window.__appStartupFallback);
            document.documentElement.classList.remove('app-loading');
            await loadData();
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
            const restrictedTabs = ['sub-properties-add', 'sub-reports', 'sub-hosting-reports', 'sub-financial-movements', 'sub-history'];
            if (userRole === 'cleaner' && restrictedTabs.includes(savedTab)) {
                switchTab('sub-agenda');
            } else if (userRole === 'admin' && savedTab === 'sub-time-entries') {
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

        function switchTab(subtabId, planLimitChecked = false) {
            closeMenuAfterAction();

            if (subtabId === 'sub-history') subtabId = 'sub-financial-movements';
            if (subtabId === 'sub-time-entries' && userRole !== 'cleaner') {
                alert(i18n[currentLang].role_locked);
                return;
            }

            if (userRole === 'cleaner' && ['sub-properties-add', 'sub-reports', 'sub-hosting-reports', 'sub-financial-movements', 'sub-subscriptions'].includes(subtabId)) {
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

            const tabs = ['sub-agenda', 'sub-properties-list', 'sub-properties-add', 'sub-reports', 'sub-hosting-reports', 'sub-financial-movements', 'sub-team-management', 'sub-time-entries', 'sub-subscriptions'];
            tabs.forEach(t => {
                const el = document.getElementById(`view-${t}`);
                if (el) el.classList.toggle('hidden', t !== subtabId);
                const btn = document.getElementById(`btn-${t}`);
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
            if (subtabId === 'sub-reports' || subtabId === 'sub-financial-movements') {
                void carregarRelatorios();
            }
            if (subtabId === 'sub-financial-movements') fetchHistoryAdmin();
            if (subtabId === 'sub-hosting-reports') {
                void carregarRelatorios();
                void carregarDocumentosHosting();
            }
            if (subtabId === 'sub-team-management') fetchTeamMembers();
            if (subtabId === 'sub-time-entries') carregarRegistosHoras();
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
            if (userRole === 'admin' && !document.getElementById('view-sub-financial-movements').classList.contains('hidden')) {
                fetchHistoryAdmin();
            }
            if (userRole === 'admin' && ['view-sub-reports', 'view-sub-financial-movements'].some(id =>
                !document.getElementById(id).classList.contains('hidden'))) {
                void carregarRelatorios();
            }
            if (userRole === 'admin' && !document.getElementById('view-sub-hosting-reports').classList.contains('hidden')) {
                void carregarDocumentosHosting();
            }
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
            await updateOfflineIndicator();
            void requestBackgroundSync();
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
            const storage = supabaseClient.storage.from('cleaning-photos');
            const { error: uploadError } = await storage.upload(item.storagePath, item.file, {
                contentType: item.file.type,
                upsert: true
            });
            if (uploadError) throw uploadError;

            const photoUrl = storage.getPublicUrl(item.storagePath).data.publicUrl;
            const { error: photoError } = await supabaseClient
                .from('cleaning_task_photos')
                .upsert([{
                    property_id: item.propertyId,
                    task_id: item.taskId,
                    uploaded_by: item.userId,
                    photo_url: photoUrl,
                    storage_path: item.storagePath
                }], { onConflict: 'storage_path', ignoreDuplicates: true });
            if (photoError) throw photoError;
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
                let photoUrl = null;
                if (item.file && item.storagePath) {
                    const storage = supabaseClient.storage.from('cleaning-photos');
                    const { error: uploadError } = await storage.upload(item.storagePath, item.file, {
                        contentType: item.file.type,
                        upsert: true
                    });
                    if (uploadError) throw uploadError;
                    photoUrl = storage.getPublicUrl(item.storagePath).data.publicUrl;
                }
                const { error } = await supabaseClient
                    .from('property_incidents')
                    .upsert([{
                        id: item.incidentId,
                        property_id: item.propertyId,
                        type: item.incidentType,
                        description: item.description,
                        photo_url: photoUrl,
                        created_by: item.userId,
                        created_at: item.createdAtISO,
                        status: 'pending'
                    }], { onConflict: 'id', ignoreDuplicates: true });
                if (error) throw error;
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

            syncPendingPromise = (async () => {
                try {
                    const allPending = await listPendingOfflineItems();
                    const pending = allPending.filter(item => item.userId === currentUser.id);
                    for (const item of pending) {
                        if (!navigator.onLine || !currentUser || item.userId !== currentUser.id) break;
                        await syncPendingOfflineItem(item);
                        await deletePendingOfflineItem(item.sequence);
                        await updateOfflineIndicator();
                    }
                    const remaining = await listPendingOfflineItems();
                    const ownPending = remaining.some(item => item.userId === currentUser.id);
                    const otherAccountPending = remaining.some(item => item.userId !== currentUser.id);
                    if (!ownPending && otherAccountPending) {
                        await updateOfflineIndicator(i18n[currentLang].offline_sync_account);
                    } else {
                        await updateOfflineIndicator();
                    }
                    if (document.getElementById('view-sub-agenda') && !document.getElementById('view-sub-agenda').classList.contains('hidden')) {
                        await loadData();
                    }
                    if (userRole === 'admin' && !document.getElementById('view-sub-financial-movements').classList.contains('hidden')) {
                        await fetchHistoryAdmin();
                    }
                    if (userRole === 'admin' && ['view-sub-reports', 'view-sub-financial-movements'].some(id =>
                        !document.getElementById(id).classList.contains('hidden'))) {
                        await carregarRelatorios();
                    }
                    if (userRole === 'admin' && !document.getElementById('view-sub-hosting-reports').classList.contains('hidden')) {
                        await carregarDocumentosHosting();
                    }
                    return !ownPending;
                } catch (error) {
                    console.error('Erro ao sincronizar dados offline:', error);
                    if (isOfflineNetworkError(error)) isOfflineMode = true;
                    await updateOfflineIndicator(i18n[currentLang].offline_sync_error);
                    return false;
                } finally {
                    syncPendingPromise = null;
                }
            })();
            return syncPendingPromise;
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

        async function carregarPropriedades() {
            const gridEl = document.getElementById('properties-grid');
            if (!gridEl) return;

            let data = allPropertiesCache;
            let error = null;
            if (navigator.onLine) {
                gridEl.innerHTML = `<p class="text-slate-400 text-xs col-span-full">${i18n[currentLang].loading_properties}</p>`;
                const result = await supabaseClient.from('properties').select('*').order('created_at', { ascending: false });
                data = result.data;
                error = result.error;
                if (!error) allPropertiesCache = data || [];
            }

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
                String(todayTasks.filter(task => task.status === 'completed').length);
            document.getElementById('agenda-today-pending').innerText =
                String(todayTasks.filter(task => task.status === 'pending').length);
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
                    .select('id, property_id, type, description, photo_url, created_at, properties!property_incidents_property_id_fkey!inner(name)')
                    .eq('status', 'pending')
                    .order('created_at', { ascending: false });
                if (requestId !== incidentRequestId) return;
                if (error) {
                    console.error('Erro ao carregar incidentes pendentes:', error);
                    list.innerHTML = `<p role="alert" class="text-xs font-semibold text-rose-700">${i18n[currentLang].incident_alerts_error}: ${escapePropertyHTML(error.message)}</p>`;
                    return;
                }
                data = incidents || [];
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
                        photo_url: item.file ? URL.createObjectURL(item.file) : null,
                        created_at: item.createdAtISO,
                        properties: {
                            name: allPropertiesCache.find(property =>
                                String(property.id) === String(item.propertyId)
                            )?.name || 'Alojamento'
                        },
                        queued: true
                    }));
                    offlinePendingIncidentUrls = data.map(item => item.photo_url).filter(Boolean);
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
                <article class="rounded-xl border border-rose-200 bg-white p-3">
                    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div class="min-w-0 flex-1">
                            <p class="text-xs font-extrabold text-slate-900">${escapePropertyHTML(incident.properties?.name || 'Alojamento')} · ${incident.type === 'forgotten_item' ? i18n[currentLang].incident_forgotten_item : i18n[currentLang].incident_damage}</p>
                            <span class="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800">${i18n[currentLang].incident_pending}</span>
                            <p class="mt-1 whitespace-pre-wrap break-words text-xs text-slate-700">${escapePropertyHTML(incident.description)}</p>
                            <p class="mt-2 text-[10px] text-slate-500">${i18n[currentLang].incident_date}: ${new Date(incident.created_at).toLocaleString(currentLang === 'pt' ? 'pt-PT' : 'en-GB')}</p>
                        </div>
                        ${incident.photo_url ? `<a href="${escapePropertyHTML(incident.photo_url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapePropertyHTML(i18n[currentLang].incident_photo)}"><img src="${escapePropertyHTML(incident.photo_url)}" alt="" class="h-20 w-20 shrink-0 rounded-lg border border-slate-200 object-cover"></a>` : ''}
                    </div>
                    ${incident.queued ? `<span class="mt-3 inline-flex min-h-11 items-center rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600">${i18n[currentLang].offline_photo_pending}</span>` : `<button type="button" onclick="resolvePropertyIncident('${escapePropertyHTML(incident.id)}')" class="mt-3 min-h-11 w-full rounded-xl bg-rose-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-rose-700 sm:w-auto">${i18n[currentLang].incident_resolve}</button>`}
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
            await carregarAlertasIncidentes();
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
                    label: photo.pending
                        ? i18n[currentLang].offline_photo_pending
                        : new Date(photo.created_at).toLocaleDateString(currentLang === 'pt' ? 'pt-PT' : 'en-US')
                }))
            ];
            return `
                <div class="space-y-3 pt-2 border-t border-slate-100">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span class="block font-bold text-slate-700">📸 ${i18n[currentLang].photo_gallery}</span>
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
                ${preferences.track_hours && userRole === 'admin' ? `
                    <div class="space-y-2 pt-2 border-t border-slate-100">
                        <label for="modal-hours-${task.id}" class="block font-bold text-slate-700">Horas Gastas</label>
                        <input type="number" step="0.5" id="modal-hours-${task.id}" value="${task.hours_spent || ''}" placeholder="ex: 2.5" class="w-full border border-slate-200 p-2.5 rounded-xl text-xs bg-white">
                    </div>
                ` : ''}
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
                    <button type="button" onclick="openIncidentReportModal('${escapePropertyHTML(task.property_id)}')" class="min-h-14 w-full rounded-2xl border-2 border-rose-300 bg-rose-50 px-4 py-3 text-left text-sm font-extrabold text-rose-800 shadow-sm transition hover:border-rose-500 hover:bg-rose-100">
                        ${i18n[currentLang].incident_report_button}
                    </button>
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
            document.getElementById('task-time-actions').innerHTML =
                renderTaskTimeActions(task, getAssignedPreferences());
            if (userRole === 'admin') {
                assignmentSelect.onchange = renderPermissionModules;
                assignmentSelect.addEventListener('change', () => {
                    document.getElementById('task-time-actions').innerHTML =
                        renderTaskTimeActions(task, getAssignedPreferences());
                });
            }
            document.getElementById('task-modal').classList.remove('hidden');
        }

        function renderTaskTimeActions(task, preferences) {
            const isAssignedCleaner = userRole === 'cleaner'
                && currentTeamMemberId
                && String(task.assigned_team_member_id) === String(currentTeamMemberId);
            const isTrackingAdmin = userRole === 'admin' && preferences.track_hours;
            if (!isAssignedCleaner && !isTrackingAdmin) return '';

            if (task.status === 'completed') {
                return task.total_duration_minutes
                    ? `<p class="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs font-bold text-emerald-800">${i18n[currentLang].time_duration_total}: ${formatTaskDuration(task.total_duration_minutes)}</p>`
                    : '';
            }

            if (task.status === 'in_progress' && task.started_at) {
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
                if (task.started_at && task.status === 'in_progress') {
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
                    const assignedMember = taskTeamMembers.find(member =>
                        String(member.id) === String(task.assigned_team_member_id)
                    );
                    const preferences = userRole === 'cleaner'
                        ? currentTeamMemberPreferences
                        : { track_hours: assignedMember?.track_hours === true };
                    const taskTimeActions = document.getElementById('task-time-actions');
                    if (taskTimeActions) taskTimeActions.innerHTML = renderTaskTimeActions(task, preferences);
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
                if (synced) await loadData();
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
                    await loadData();
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

        function openIncidentReportModal(propertyId) {
            if (!currentUser || !propertyId) {
                alert(i18n[currentLang].incident_error);
                return;
            }
            incidentTaskContext = { propertyId };
            const form = document.getElementById('incident-report-form');
            form.reset();
            document.getElementById('incident-report-message').classList.add('hidden');
            const preview = document.getElementById('incident-photo-preview');
            preview.removeAttribute('src');
            preview.classList.add('hidden');
            document.getElementById('incident-report-modal').classList.remove('hidden');
        }

        function closeIncidentReportModal() {
            document.getElementById('incident-report-modal').classList.add('hidden');
            const preview = document.getElementById('incident-photo-preview');
            if (preview.src.startsWith('blob:')) URL.revokeObjectURL(preview.src);
            preview.removeAttribute('src');
            preview.classList.add('hidden');
            incidentTaskContext = null;
        }

        async function submitPropertyIncident(event) {
            event.preventDefault();
            if (!incidentTaskContext || !currentUser) {
                showPropertyMessage('incident-report-message', i18n[currentLang].incident_error, 'error');
                return;
            }

            const file = document.getElementById('incident-photo').files?.[0] || null;
            if (file && (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024)) {
                showPropertyMessage('incident-report-message', i18n[currentLang].incident_photo_error, 'error');
                return;
            }
            const submitButton = document.getElementById('incident-submit-button');
            const message = document.getElementById('incident-report-message');
            submitButton.disabled = true;
            submitButton.innerText = i18n[currentLang].incident_submitting;
            message.classList.add('hidden');

            try {
                const incidentId = crypto.randomUUID();
                let storagePath = null;
                if (file) {
                    const extensionByType = {
                        'image/jpeg': 'jpg',
                        'image/png': 'png',
                        'image/webp': 'webp',
                        'image/gif': 'gif',
                        'image/heic': 'heic',
                        'image/heif': 'heif'
                    };
                    const extension = extensionByType[file.type.toLowerCase()];
                    if (!extension) throw new Error(i18n[currentLang].incident_photo_error);
                    storagePath = `${currentUser.id}/incidents/${incidentTaskContext.propertyId}/${incidentId}.${extension}`;
                }

                const queued = await savePendingOfflineItem({
                    type: 'incident',
                    incidentId,
                    propertyId: incidentTaskContext.propertyId,
                    incidentType: document.getElementById('incident-type').value,
                    description: document.getElementById('incident-description').value.trim(),
                    file,
                    storagePath,
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
                const preview = document.getElementById('incident-photo-preview');
                if (preview.src.startsWith('blob:')) URL.revokeObjectURL(preview.src);
                preview.removeAttribute('src');
                preview.classList.add('hidden');
                if (synced && userRole === 'admin') void carregarAlertasIncidentes();
            } catch (error) {
                console.error('Erro ao reportar incidente:', error);
                showPropertyMessage('incident-report-message', `${i18n[currentLang].incident_error}: ${error.message}`, 'error');
            } finally {
                submitButton.disabled = false;
                submitButton.innerText = i18n[currentLang].incident_submit;
            }
        }

        document.getElementById('incident-photo')?.addEventListener('change', event => {
            const file = event.target.files?.[0];
            const preview = document.getElementById('incident-photo-preview');
            if (preview.src.startsWith('blob:')) URL.revokeObjectURL(preview.src);
            if (!file) {
                preview.removeAttribute('src');
                preview.classList.add('hidden');
                return;
            }
            if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) {
                showPropertyMessage('incident-report-message', i18n[currentLang].incident_photo_error, 'error');
                event.target.value = '';
                preview.removeAttribute('src');
                preview.classList.add('hidden');
                return;
            }
            preview.src = URL.createObjectURL(file);
            preview.classList.remove('hidden');
            document.getElementById('incident-report-message').classList.add('hidden');
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

            window.location.href = paymentLink;
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
            if (taskAwaitingTimeConfirmation) return;
            document.getElementById('task-modal').classList.add('hidden');
            offlinePendingPhotoUrls.forEach(url => URL.revokeObjectURL(url));
            offlinePendingPhotoUrls = [];
        }

        async function saveTaskModalDetails(taskId) {
            if (!requireAdminAction()) return;
            const status = document.getElementById(`modal-status-${taskId}`).value;
            const task = allTasksCache.find(item => String(item.id) === String(taskId));
            const assignedMember = taskTeamMembers.find(member =>
                String(member.id) === String(task?.assigned_team_member_id)
            );
            if (status === 'completed') {
                if (!task?.started_at) {
                    alert(i18n[currentLang].time_task_not_started);
                    return;
                }
                if (assignedMember?.track_hours) {
                    openTimeConfirmation(task);
                } else {
                    await requestCleaningCompletion(taskId);
                }
                return;
            }
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

        async function carregarRelatorios() {
            const cardsEl = document.getElementById('reports-summary-cards');
            const transactionsEl = document.getElementById('financial-transactions-list');
            const propertyListEl = document.getElementById('reports-property-list');
            const propertySelect = document.getElementById('financial-property');
            const filterPropertySelect = document.getElementById('financial-filter-property');
            const monthInput = document.getElementById('financial-filter-month');
            if (!cardsEl || !transactionsEl || !propertyListEl || userRole !== 'admin' || !currentUser) return;

            const requestId = ++reportsRequestId;
            cardsEl.innerHTML = `<p class="text-slate-400 text-xs">${i18n[currentLang].reports_loading}</p>`;
            transactionsEl.innerHTML = `<p class="text-slate-400 text-xs">${i18n[currentLang].reports_loading}</p>`;
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

                const transactionCount = document.getElementById('financial-transactions-count');
                transactionCount.innerText = i18n[currentLang].finance_transaction_count.replace('{count}', String(entries.length));
                if (!entries.length) {
                    transactionsEl.innerHTML = `<p class="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-400">${i18n[currentLang].finance_no_transactions}</p>`;
                } else {
                    transactionsEl.innerHTML = entries.map(entry => {
                        const isIncome = entry.entry_type === 'income';
                        const isPaid = entry.status === 'paid';
                        const date = new Date(`${entry.occurred_on}T00:00:00`).toLocaleDateString(
                            currentLang === 'pt' ? 'pt-PT' : 'en-US',
                            { day: '2-digit', month: 'short', year: 'numeric' }
                        );
                        const statusClass = isPaid
                            ? 'border-emerald-800 bg-emerald-950 text-emerald-300'
                            : 'border-amber-800 bg-amber-950 text-amber-300';
                        return `
                            <article class="grid grid-cols-1 gap-2 rounded-xl border border-slate-800 bg-slate-900/70 p-3 sm:grid-cols-[minmax(0,1.5fr)_minmax(100px,1fr)_auto_auto] sm:items-center">
                                <div class="min-w-0">
                                    <p class="truncate text-xs font-bold text-white">${escapePropertyHTML(entry.description)}</p>
                                    <p class="mt-1 truncate text-[10px] text-slate-400">${escapePropertyHTML(propertiesById.get(String(entry.property_id))?.name || '')} · ${date}</p>
                                </div>
                                <span class="text-[10px] font-semibold ${isIncome ? 'text-emerald-300' : 'text-rose-300'}">${isIncome ? i18n[currentLang].reports_income : i18n[currentLang].reports_expense}</span>
                                <span class="w-fit rounded-full border px-2.5 py-1 text-[9px] font-bold ${statusClass}">${isPaid ? i18n[currentLang].finance_paid : i18n[currentLang].finance_pending}</span>
                                <strong class="text-sm font-extrabold ${isIncome ? 'text-emerald-300' : 'text-rose-300'}">${isIncome ? '+' : '−'}${formatFinancialAmount(Number(entry.amount))}</strong>
                            </article>
                        `;
                    }).join('');
                }
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
                transactionsEl.innerHTML = `<p class="text-rose-300 text-xs">${escapePropertyHTML(error.message)}</p>`;
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
            const description = document.getElementById('financial-description').value.trim();
            const occurredOn = document.getElementById('financial-date').value;
            const status = document.getElementById('financial-status').value;
            if (!propertyId || !['income', 'expense'].includes(entryType) || !['paid', 'pending'].includes(status) || !Number.isFinite(amount) || amount <= 0 || !description || !occurredOn) {
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
                        occurred_on: occurredOn,
                        status
                    }]);
                if (error) throw error;

                document.getElementById('financial-entry-form').reset();
                document.getElementById('financial-date').value = getLocalDateString();
                await carregarRelatorios();
                showPropertyMessage('financial-entry-message', i18n[currentLang].reports_entry_success, 'success');
            } catch (error) {
                console.error('Erro ao registar movimento financeiro:', error);
                showPropertyMessage('financial-entry-message', `${i18n[currentLang].reports_entry_error}: ${error.message}`, 'error');
            } finally {
                submitButton.disabled = false;
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
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, ' ')
                .trim();
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
                const key = `${earning.property_id}|${earning.occurred_on}|${earning.description}|${earning.amount.toFixed(2)}`;
                if (existingKeys.has(key)) {
                    duplicates += 1;
                    return;
                }
                existingKeys.add(key);
                newEntries.push({ ...earning, user_id: currentUser.id });
            });

            if (newEntries.length) {
                const { error: insertError } = await supabaseClient
                    .from('property_financial_entries')
                    .insert(newEntries);
                if (insertError) throw insertError;
            }
            return { matched: earnings.length, inserted: newEntries.length, duplicates };
        }

        async function processAirbnbPDF(file, properties) {
            const text = await extractTextFromPDF(file);
            const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
            const propertyRows = [];
            const validProperties = (properties || [])
                .filter(property => property?.id && property?.name)
                .map(property => ({ ...property, normalizedName: normalizeAirbnbText(property.name) }))
                .filter(property => property.normalizedName.length >= 3);

            lines.forEach((line, index) => {
                const normalizedLine = normalizeAirbnbText(line);
                const matches = validProperties
                    .filter(property => normalizedLine.includes(property.normalizedName))
                    .sort((a, b) => b.normalizedName.length - a.normalizedName.length);
                if (!matches.length) return;
                const longestMatches = matches.filter(property => property.normalizedName.length === matches[0].normalizedName.length);
                const uniqueIds = new Set(longestMatches.map(property => property.id));
                if (uniqueIds.size !== 1) return;
                propertyRows.push({ index, property: longestMatches[0] });
            });

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
                        property_id: row.property.id,
                        entry_type: 'income',
                        amount: Math.round(amount * 100) / 100,
                        description: `Airbnb: ${transactionType}`.slice(0, 200),
                        occurred_on: date.occurredOn,
                        status: 'paid'
                    });
                }
            }

            return persistPlatformEarnings('Airbnb', earnings);
        }

        async function processBookingPDF(file, properties) {
            const text = await extractTextFromPDF(file);
            const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
            const validProperties = (properties || [])
                .filter(property => property?.id && property?.name)
                .map(property => ({ ...property, normalizedName: normalizeAirbnbText(property.name) }))
                .filter(property => property.normalizedName.length >= 3)
                .sort((a, b) => b.normalizedName.length - a.normalizedName.length);
            const propertyRows = [];

            lines.forEach((line, index) => {
                const normalizedLine = normalizeAirbnbText(line);
                const matches = validProperties.filter(property => normalizedLine.includes(property.normalizedName));
                if (!matches.length) return;
                const longestMatches = matches.filter(property => property.normalizedName.length === matches[0].normalizedName.length);
                if (new Set(longestMatches.map(property => property.id)).size !== 1) return;
                propertyRows.push({ index, property: longestMatches[0] });
            });

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
                const existing = totalsByProperty.get(row.property.id);
                if (existing) {
                    existing.amount = Math.round((existing.amount + amount) * 100) / 100;
                    if (latestDate && (!existing.occurred_on || latestDate > existing.occurred_on)) {
                        existing.occurred_on = latestDate;
                    }
                } else {
                    totalsByProperty.set(row.property.id, {
                        property_id: row.property.id,
                        entry_type: 'income',
                        amount,
                        description: 'Booking.com: Reservas consolidadas',
                        occurred_on: latestDate || getLocalDateString(),
                        status: 'paid'
                    });
                }
            }

            return [...totalsByProperty.values()];
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
                            platformImportResult = await processAirbnbPDF(file, properties || []);
                        } else {
                            const earnings = await processBookingPDF(file, properties || []);
                            platformImportResult = await persistPlatformEarnings('Booking.com', earnings);
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
                if (platformImportResult?.inserted) await carregarRelatorios();
                const importMessagePrefix = normalizedPlatformName === 'booking.com' ? 'hosting_booking_import' : 'hosting_airbnb_import';
                if (platformImportError) {
                    showPropertyMessage(
                        'hosting-report-message',
                        `${i18n[currentLang][`${importMessagePrefix}_error`]}: ${platformImportError.message}`,
                        'error'
                    );
                } else if (platformImportResult?.matched === 0) {
                    showPropertyMessage('hosting-report-message', i18n[currentLang][`${importMessagePrefix}_none`], 'error');
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
                isOfflineMode = false;
                void syncPendingData();
            });
            window.addEventListener('offline', () => {
                isOfflineMode = true;
                void updateOfflineIndicator();
            });
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.addEventListener('message', event => {
                    if (event.data?.type === 'HOST_CLEANER_SYNC_PENDING') void syncPendingData();
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
