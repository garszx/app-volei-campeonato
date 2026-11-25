'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import { supabase } from '../../supabase';
import { Patota } from '../../types/patota';

function gerarSlug(titulo: string) {
  const base = titulo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const sufixo = Math.random().toString(36).substring(2, 6);
  return `${base || 'patota'}-${sufixo}`;
}

export default function PaginaPatotas() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [patotas, setPatotas] = useState<Patota[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Campos do formulário
  const [titulo, setTitulo] = useState('');
  const [localNome, setLocalNome] = useState('');
  const [localMapsUrl, setLocalMapsUrl] = useState('');
  const [dataHora, setDataHora] = useState('');
  const [formato, setFormato] = useState('6x6');
  const [nivel, setNivel] = useState('Misto / Intermediário');
  const [vagasTotal, setVagasTotal] = useState(18);
  const [valor, setValor] = useState(15);
  const [pixChave, setPixChave] = useState('');
  const [pixTitular, setPixTitular] = useState('');
  const [contatoWhatsapp, setContatoWhatsapp] = useState('');
  const [horasTrava, setHorasTrava] = useState(4);

  useEffect(() => {
    async function init() {
      const { data: authData } = await supabase.auth.getUser();
      setUser(authData.user ?? null);

      const { data } = await supabase
        .from('patotas')
        .select('*')
        .eq('status', 'aberta')
        .order('data_hora', { ascending: true });

      if (data) setPatotas(data as Patota[]);
      setCarregando(false);
    }
    init();
  }, []);

  const entrarComGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href },
    });
  };

  const sair = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const criarPatota = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return alert('Faça login primeiro para criar uma patota.');
    if (!titulo.trim() || !localNome.trim() || !dataHora) {
      return alert('Preencha título, local e data/hora.');
    }

    setSalvando(true);
    const slug = gerarSlug(titulo);

    const { data, error } = await supabase
      .from('patotas')
      .insert({
        slug,
        criador_id: user.id,
        titulo: titulo.trim(),
        local_nome: localNome.trim(),
        local_maps_url: localMapsUrl.trim() || null,
        data_hora: new Date(dataHora).toISOString(),
        formato,
        nivel,
        vagas_total: Number(vagasTotal),
        valor: Number(valor),
        tipo_pagamento: pixChave.trim() ? 'pix' : 'local',
        pix_chave: pixChave.trim() || null,
        pix_titular: pixTitular.trim() || null,
        contato_nome: user.user_metadata?.full_name || user.email || 'Organizador',
        contato_whatsapp: contatoWhatsapp.trim() || null,
        mostrar_whatsapp_no_link: Boolean(contatoWhatsapp.trim()),
        horas_trava_cancelamento: Number(horasTrava),
        status: 'aberta',
      })
      .select()
      .single();

    setSalvando(false);

    if (error) {
      console.error(error);
      alert('Erro ao criar patota: ' + error.message);
      return;
    }

    if (data) {
      router.push(`/p/${data.slug}`);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #334155',
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    fontSize: '14px',
    boxSizing: 'border-box' as const,
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#f8fafc', padding: '24px 16px' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>
        {/* Topo */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '26px' }}>🏐 Patotas de Vôlei</h1>
            <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: '14px' }}>
              Listas de presença com fila de espera automática e controle de Pix
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <Link
              href="/setup"
              style={{
                padding: '8px 14px',
                backgroundColor: '#1e293b',
                color: '#f8fafc',
                border: '1px solid #334155',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: 'bold',
                fontSize: '13px',
              }}
            >
              🏆 Setup de Campeonatos
            </Link>

            {user ? (
              <>
                <span style={{ fontSize: '13px', color: '#cbd5e1' }}>
                  {user.user_metadata?.full_name || user.email}
                </span>
                <button
                  onClick={sair}
                  style={{ padding: '6px 12px', backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                >
                  Sair
                </button>
              </>
            ) : (
              <button
                onClick={entrarComGoogle}
                style={{ padding: '8px 16px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
              >
                Entrar com Google
              </button>
            )}
          </div>
        </div>

        {/* Botão Criar Patota */}
        {user && (
          <div style={{ marginBottom: '24px' }}>
            <button
              onClick={() => setMostrarForm(!mostrarForm)}
              style={{ width: '100%', padding: '12px', backgroundColor: mostrarForm ? '#334155' : '#10b981', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' }}
            >
              {mostrarForm ? '✕ Fechar Formulário' : '+ Criar Nova Patota'}
            </button>
          </div>
        )}

        {/* Formulário de Criação */}
        {mostrarForm && user && (
          <form onSubmit={criarPatota} style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px', marginBottom: '28px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h2 style={{ margin: 0, fontSize: '18px' }}>Nova Patota</h2>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Título *</label>
              <input style={inputStyle} placeholder="Ex: Vôlei de Quinta - Bruno Hoeltgebaum" value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Local / Ginásio *</label>
                <input style={inputStyle} placeholder="Ex: EEB Bruno Hoeltgebaum" value={localNome} onChange={(e) => setLocalNome(e.target.value)} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Data e Hora *</label>
                <input type="datetime-local" style={inputStyle} value={dataHora} onChange={(e) => setDataHora(e.target.value)} required />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Link do Google Maps (opcional)</label>
              <input style={inputStyle} placeholder="https://maps.google.com/..." value={localMapsUrl} onChange={(e) => setLocalMapsUrl(e.target.value)} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Formato</label>
                <input style={inputStyle} value={formato} onChange={(e) => setFormato(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Nível</label>
                <input style={inputStyle} value={nivel} onChange={(e) => setNivel(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Total de Vagas</label>
                <input type="number" min={2} style={inputStyle} value={vagasTotal} onChange={(e) => setVagasTotal(Number(e.target.value))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Valor (R$)</label>
                <input type="number" step="0.5" min={0} style={inputStyle} value={valor} onChange={(e) => setValor(Number(e.target.value))} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Chave Pix (opcional)</label>
                <input style={inputStyle} placeholder="CPF, telefone, e-mail ou aleatória" value={pixChave} onChange={(e) => setPixChave(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Titular do Pix</label>
                <input style={inputStyle} placeholder="Nome de quem recebe" value={pixTitular} onChange={(e) => setPixTitular(e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>WhatsApp Contato (com DDD)</label>
                <input style={inputStyle} placeholder="47999999999" value={contatoWhatsapp} onChange={(e) => setContatoWhatsapp(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Trava de cancelamento (horas antes)</label>
                <input type="number" min={0} style={inputStyle} value={horasTrava} onChange={(e) => setHorasTrava(Number(e.target.value))} />
              </div>
            </div>

            <button
              type="submit"
              disabled={salvando}
              style={{ padding: '12px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px', marginTop: '6px' }}
            >
              {salvando ? 'Criando...' : 'Publicar Patota e Abrir Link'}
            </button>
          </form>
        )}

        {/* Lista de Patotas Abertas */}
        {carregando ? (
          <p style={{ textAlign: 'center', color: '#94a3b8' }}>Carregando patotas...</p>
        ) : patotas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', backgroundColor: '#1e293b', borderRadius: '12px', border: '1px solid #334155', color: '#94a3b8' }}>
            Nenhuma patota aberta no momento.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {patotas.map((p) => (
              <Link
                key={p.id}
                href={`/p/${p.slug}`}
                style={{
                  display: 'block',
                  textDecoration: 'none',
                  color: 'inherit',
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '12px',
                  padding: '16px 20px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap' }}>
                  <div>
                    <h3 style={{ margin: '0 0 6px', fontSize: '18px', color: '#f8fafc' }}>{p.titulo}</h3>
                    <div style={{ fontSize: '13px', color: '#94a3b8' }}>
                      📍 {p.local_nome} • 📅 {new Date(p.data_hora).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '999px', backgroundColor: '#0f172a', border: '1px solid #3b82f6', color: '#60a5fa', fontSize: '12px', fontWeight: 'bold' }}>
                      {p.vagas_total} vagas • R$ {Number(p.valor).toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}