'use client';

import Image from 'next/image';
import { useState } from 'react';
import { supabase } from '../../../supabase';
import { Regras } from '../../../types/torneio';

interface Props {
  torneioId: string;
  regrasAtuais: Regras;
  aoAtualizar: (novasRegras: Regras) => void;
}

const COR_PADRAO = '#3b82f6'; // Azul padrão atual

export default function ConfiguracaoTema({ torneioId, regrasAtuais, aoAtualizar }: Props) {
  const [cor, setCor] = useState(regrasAtuais.corPrimaria || COR_PADRAO);
  const [logo, setLogo] = useState(regrasAtuais.logoUrl || '');
  const [salvando, setSalvando] = useState(false);

  // Lê a imagem, redimensiona em alta qualidade (WebP) e extrai a cor vibrante dominante
  const processarLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Máx 800px para manter nitidez no fundo (desktop e telas Retina no celular)
        const max = 800;
        const escala = Math.min(max / img.width, max / img.height, 1);
        canvas.width = img.width * escala;
        canvas.height = img.height * escala;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const base64Leve = canvas.toDataURL('image/webp', 0.85);
        setLogo(base64Leve);

        // Extrai cor dominante ignorando transparência, branco e preto
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let rTotal = 0, gTotal = 0, bTotal = 0, contagem = 0;

        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const a = pixels[i + 3];

          if (a < 128) continue;
          const brilho = (r + g + b) / 3;
          const saturacao = Math.max(r, g, b) - Math.min(r, g, b);

          if (brilho > 35 && brilho < 230 && saturacao > 35) {
            rTotal += r;
            gTotal += g;
            bTotal += b;
            contagem++;
          }
        }

        if (contagem > 0) {
          const rMed = Math.round(rTotal / contagem);
          const gMed = Math.round(gTotal / contagem);
          const bMed = Math.round(bTotal / contagem);
          const hex = '#' + [rMed, gMed, bMed].map((x) => x.toString(16).padStart(2, '0')).join('');
          setCor(hex);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const salvarNoBanco = async (novaCor: string, novaLogo: string) => {
    setSalvando(true);
    const novasRegras: Regras = {
      ...regrasAtuais,
      corPrimaria: novaCor,
      logoUrl: novaLogo,
    };

    const { error } = await supabase
      .from('torneios')
      .update({ regras: novasRegras })
      .eq('id', torneioId);

    setSalvando(false);

    if (error) {
      alert('Erro ao salvar aparência.');
      console.error(error);
    } else {
      aoAtualizar(novasRegras);
    }
  };

  const restaurarPadrao = () => {
    setCor(COR_PADRAO);
    setLogo('');
    salvarNoBanco(COR_PADRAO, '');
  };

  return (
    <div style={{
      backgroundColor: '#1e293b',
      border: '1px solid #334155',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '20px',
      color: '#f8fafc'
    }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>🎨 Aparência do Torneio</h3>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
        {/* Upload da Logo */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>
            Logo do Campeonato / Time
          </label>
          <input type="file" accept="image/*" onChange={processarLogo} style={{ fontSize: '12px', maxWidth: '100%' }} />
        </div>

        {/* Prévia da Logo */}
        {logo && (
          <Image
            src={logo}
            alt="Logo"
            width={48}
            height={48}
            unoptimized
            style={{ objectFit: 'contain', borderRadius: '8px', background: '#fff', padding: '4px' }}
          />
        )}

        {/* Seletor de Cor */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>
            Cor de Destaque
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="color"
              value={cor}
              onChange={(e) => setCor(e.target.value)}
              style={{ width: '40px', height: '36px', border: 'none', borderRadius: '6px', cursor: 'pointer', background: 'none' }}
            />
            <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#cbd5e1' }}>{cor}</span>
          </div>
        </div>

        {/* Botões de Ação */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginLeft: 'auto' }}>
          <button
            onClick={() => salvarNoBanco(cor, logo)}
            disabled={salvando}
            style={{
              padding: '8px 16px',
              backgroundColor: cor,
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            {salvando ? 'Salvando...' : 'Aplicar Tema'}
          </button>

          <button
            onClick={restaurarPadrao}
            disabled={salvando}
            style={{
              padding: '8px 14px',
              backgroundColor: '#334155',
              color: '#e2e8f0',
              border: '1px solid #475569',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            Restaurar Azul Padrão
          </button>
        </div>
      </div>
    </div>
  );
}