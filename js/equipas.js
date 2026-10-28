const teamInviteTokens = new Map();

async function fetchTeamMembers() {
    const listEl = document.getElementById('team-members-list');
    if (!listEl) return;

    const { data, error } = await supabaseClient
        .from('team_members')
        .select('id, name, email, phone, role, auth_user_id, track_hours, require_photos, created_at')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Erro ao carregar membros da equipa:', error);
        listEl.innerHTML = `<p class="text-rose-600 text-xs py-2">Erro ao carregar os membros da equipa: ${escapeTeamMemberAttribute(error.message)}</p>`;
        return;
    }
    if (!data || data.length === 0) {
        listEl.innerHTML = '<p class="text-slate-400 text-xs py-2">Ainda não adicionou membros à sua equipa.</p>';
        return;
    }

    listEl.innerHTML = data.map(member => `
        <div class="border border-slate-200 bg-slate-50 p-3.5 rounded-2xl space-y-3 text-xs">
            <div class="flex justify-between items-center">
                <div>
                    <strong class="text-slate-900 block">${escapeTeamMemberAttribute(member.name || member.email || 'Membro da equipa')}</strong>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${member.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-indigo-100 text-indigo-800'}">${member.role === 'admin' ? '👑 Administrador' : '🧹 Equipa de Limpeza'}</span>
                </div>
                <button type="button" data-team-remove-id="${escapeTeamMemberAttribute(member.id)}" class="p-2 text-rose-500 hover:text-rose-700 font-bold transition">🗑️ Remover</button>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label class="block text-xs font-medium text-slate-700">
                    <span data-i18n="team_name">Nome</span>
                    <input data-team-name-id="${escapeTeamMemberAttribute(member.id)}" type="text" value="${escapeTeamMemberAttribute(member.name || '')}" class="mt-1 w-full border border-slate-200 bg-white p-2.5 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500">
                </label>
                <label class="block text-xs font-medium text-slate-700">
                    <span data-i18n="team_phone">Telemóvel</span>
                    <input data-team-phone-id="${escapeTeamMemberAttribute(member.id)}" type="tel" autocomplete="tel" value="${escapeTeamMemberAttribute(member.phone || '+351 ')}" placeholder="${escapeTeamMemberAttribute(i18n[currentLang].team_phone_placeholder)}" class="mt-1 w-full border border-slate-200 bg-white p-2.5 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500">
                </label>
            </div>
            ${member.role === 'cleaner' ? `<div class="grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-slate-200 pt-3">
                <label class="flex items-center gap-2 text-xs font-medium text-slate-700">
                    <input type="checkbox" ${member.track_hours === true ? 'checked' : ''} data-team-preference-id="${escapeTeamMemberAttribute(member.id)}" data-preference="track_hours" class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500">
                    <span data-i18n="team_track_hours">Ativar registo de horas</span>
                </label>
                <label class="flex items-center gap-2 text-xs font-medium text-slate-700">
                    <input type="checkbox" ${member.require_photos === true ? 'checked' : ''} data-team-preference-id="${escapeTeamMemberAttribute(member.id)}" data-preference="require_photos" class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500">
                    <span data-i18n="team_require_photos">Exigir fotos antes e depois</span>
                </label>
            </div>` : ''}
            ${member.role === 'cleaner' && !member.auth_user_id ? `<div class="border-t border-slate-200 pt-3 flex flex-wrap gap-2">
                <button type="button" data-team-whatsapp-id="${escapeTeamMemberAttribute(member.id)}" class="rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-emerald-700 transition" ${member.phone ? '' : 'disabled'}>
                    💬 <span data-i18n="team_whatsapp_invite">Enviar acesso por WhatsApp</span>
                </button>
                <button type="button" data-team-copy-id="${escapeTeamMemberAttribute(member.id)}" class="rounded-xl bg-slate-200 px-3 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-300 transition">
                    📋 <span data-i18n="team_copy_link">Copiar Link</span>
                </button>
            </div>` : ''}
        </div>
    `).join('');

    listEl.querySelectorAll('[data-team-name-id]').forEach(input => {
        input.addEventListener('change', () => saveTeamMemberField(input.dataset.teamNameId, 'name', input.value.trim()));
    });
    listEl.querySelectorAll('[data-team-phone-id]').forEach(input => {
        input.addEventListener('change', () => saveTeamMemberField(input.dataset.teamPhoneId, 'phone', input.value.trim()));
    });
    listEl.querySelectorAll('[data-team-preference-id]').forEach(input => {
        input.addEventListener('change', () => updateTeamMemberPreference(input.dataset.teamPreferenceId, input.dataset.preference, input.checked));
    });
    listEl.querySelectorAll('[data-team-whatsapp-id]').forEach(button => {
        button.addEventListener('click', () => sendTeamAccessByWhatsApp(button.dataset.teamWhatsappId));
    });
    listEl.querySelectorAll('[data-team-copy-id]').forEach(button => {
        button.addEventListener('click', () => copyTeamAccessLink(button.dataset.teamCopyId));
    });
    listEl.querySelectorAll('[data-team-remove-id]').forEach(button => {
        button.addEventListener('click', () => removeTeamMember(button.dataset.teamRemoveId));
    });
    changeLanguage(currentLang);
}

async function handleAddTeamMember(event) {
    event.preventDefault();
    const name = document.getElementById('team-name').value.trim();
    const phone = normalizeTeamPhone(document.getElementById('team-phone').value);
    const preferences = {
        track_hours: document.getElementById('team-track-hours').checked,
        require_photos: document.getElementById('team-require-photos').checked
    };

    if (!name || phone.replace(/\D/g, '').length < 8) {
        alert('Introduza o nome e o número de telemóvel do membro.');
        return;
    }

    const button = document.getElementById('btn-add-team');
    button.disabled = true;
    button.innerText = 'A criar convite...';

    try {
        const { data, error } = await supabaseClient.rpc('create_team_member_invite', {
            p_name: name,
            p_phone: phone,
            p_track_hours: preferences.track_hours,
            p_require_photos: preferences.require_photos
        });
        if (error) throw error;

        const invite = Array.isArray(data) ? data[0] : data;
        if (!invite || !invite.member_id || !invite.invite_token) {
            throw new Error('A base de dados não devolveu os dados do convite.');
        }

        teamInviteTokens.set(String(invite.member_id), invite.invite_token);
        alert(`Membro ${name} criado. Use WhatsApp ou Copiar Link na lista para partilhar o convite.`);
        document.getElementById('team-add-form').reset();
        await fetchTeamMembers();
    } catch (error) {
        console.error('Erro ao criar convite para membro da equipa:', error);
        alert('Não foi possível criar o membro e o convite: ' + error.message + '\nConfirme se aplicou a migração de convites no Supabase.');
    } finally {
        button.disabled = false;
        button.innerText = i18n[currentLang].btn_send_invite;
    }
}

function normalizeTeamPhone(phone) {
    let value = String(phone || '').trim();
    if (!value) return '';
    let digits = value.replace(/\D/g, '');
    if (value.startsWith('00')) digits = digits.slice(2);
    if (!value.startsWith('+') && !digits.startsWith('351')) digits = `351${digits}`;
    return `+${digits}`;
}

function escapeTeamMemberAttribute(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function formatPhoneForWhatsApp(phone) {
    const normalized = normalizeTeamPhone(phone);
    const digits = normalized.replace(/\D/g, '');
    if (digits.length < 8) {
        throw new Error('Introduza um número de telemóvel válido, por exemplo +351 912 345 678.');
    }
    return digits;
}

async function saveTeamMemberField(memberId, field, value) {
    let updatedValue = value || null;
    if (field === 'phone' && value) {
        updatedValue = normalizeTeamPhone(value);
        if (updatedValue.replace(/\D/g, '').length < 8) {
            alert('Introduza um número de telemóvel válido, por exemplo +351 912 345 678.');
            await fetchTeamMembers();
            return;
        }
    }
    const { error } = await supabaseClient
        .from('team_members')
        .update({ [field]: updatedValue })
        .eq('id', memberId);
    if (error) {
        console.error(`Erro ao guardar ${field} do membro:`, error);
        alert(`Não foi possível guardar os dados do membro: ${error.message}`);
        await fetchTeamMembers();
    }
}

async function getTeamAccessLink(memberId) {
    let token = teamInviteTokens.get(String(memberId));
    if (!token) {
        const { data, error } = await supabaseClient.rpc('rotate_team_member_invite', {
            p_member_id: memberId
        });
        if (error) throw error;
        const invite = Array.isArray(data) ? data[0] : data;
        token = invite && invite.invite_token;
        if (!token) throw new Error('A base de dados não devolveu um token de convite.');
        teamInviteTokens.set(String(memberId), token);
    }

    const url = new URL(window.location.href);
    url.searchParams.set('invite', token);
    url.hash = '';
    return url.toString();
}

async function sendTeamAccessByWhatsApp(memberId) {
    const phoneInput = [...document.querySelectorAll('[data-team-phone-id]')]
        .find(input => input.dataset.teamPhoneId === String(memberId));
    const nameInput = [...document.querySelectorAll('[data-team-name-id]')]
        .find(input => input.dataset.teamNameId === String(memberId));
    if (!phoneInput) {
        alert('Não foi possível encontrar o telemóvel deste membro.');
        return;
    }

    const whatsappWindow = window.open('about:blank', '_blank');
    if (!whatsappWindow) {
        alert('Permita a abertura de janelas pop-up para enviar o convite por WhatsApp.');
        return;
    }
    try {
        const phone = formatPhoneForWhatsApp(phoneInput.value);
        const link = await getTeamAccessLink(memberId);
        const memberName = nameInput && nameInput.value.trim() || 'Membro da equipa';
        const message = `Olá ${memberName}! 👋 É com muito prazer que o convidamos para se juntar à nossa equipa na aplicação Host a Cleaner. \n\nPor favor, clique no link abaixo para criar a sua conta:\n\n${link}\n\nSe tiver alguma dúvida, não hesite em contactar-nos. Até breve! 😊`;
        whatsappWindow.location.href = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    } catch (error) {
        whatsappWindow.close();
        console.error('Erro ao preparar convite WhatsApp:', error);
        alert('Não foi possível preparar o convite: ' + error.message);
    }
}

async function copyTeamAccessLink(memberId) {
    let link;
    try {
        link = await getTeamAccessLink(memberId);
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(link);
            alert(i18n[currentLang].team_link_copied);
            return;
        }
    } catch (error) {
        if (link) {
            console.error('Erro ao copiar link de acesso:', error);
        } else {
            console.error('Erro ao gerar link de acesso:', error);
            alert('Não foi possível gerar o link: ' + error.message);
            return;
        }
    }

    const input = document.createElement('textarea');
    input.value = link;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.focus();
    input.select();
    const copied = document.execCommand('copy');
    input.remove();
    if (copied) {
        alert(i18n[currentLang].team_link_copied);
        return;
    }

    const error = new Error('O browser não conseguiu copiar o link.');
    console.error('Erro ao copiar link de acesso:', error);
    alert(`Não foi possível copiar o link: ${error.message}\n${link}`);
}

async function updateTeamMemberPreference(memberId, preference, enabled) {
    const allowedPreferences = ['track_hours', 'require_photos'];
    if (!allowedPreferences.includes(preference)) {
        throw new Error(`Preferência de equipa inválida: ${preference}`);
    }
    const { error } = await supabaseClient
        .from('team_members')
        .update({ [preference]: enabled })
        .eq('id', memberId);
    if (error) {
        console.error('Erro ao guardar preferência do membro:', error);
        alert('Não foi possível guardar a preferência: ' + error.message);
        await fetchTeamMembers();
    }
}

async function removeTeamMember(memberId) {
    if (!confirm('Deseja mesmo remover este membro da equipa?')) return;
    const { error } = await supabaseClient.from('team_members').delete().eq('id', memberId);
    if (error) {
        console.error('Erro ao remover membro da equipa:', error);
        alert('Não foi possível remover o membro: ' + error.message);
        return;
    }
    teamInviteTokens.delete(String(memberId));
    await fetchTeamMembers();
}
