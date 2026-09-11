// app/setup/page.tsx
"use client";

import { useState, FormEvent, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '../../firebase'; // Ajuste o caminho se necessário
import { ref as dbRef, set } from 'firebase/database';
import styles from './setup.module.css';

// 1. Definindo as tipagens (Interfaces)
interface TimeData {
  nome: string;
  escudoFile: File | null;
}

interface TimeProcessado {
  id: string;
  nome: string;
  escudoUrl: string;
  sets_vencidos: number;
  total_pontos: number;
}

// 2. Função auxiliar para converter a imagem em texto (Base64)
const converterParaBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

export default function SetupTorneio() {
  const router = useRouter();
  const [campeonatoNome, setCampeonatoNome] = useState<string>('');
  
  const [times, setTimes] = useState<TimeData[]>(
    Array(6).fill({ nome: '', escudoFile: null })
  );
  
  const [loading, setLoading] = useState<boolean>(false);

  const handleNameChange = (index: number, value: string) => {
    const novosTimes = [...times];
    novosTimes[index] = { ...novosTimes[index], nome: value };
    setTimes(novosTimes);
  };

  const handleFileChange = (index: number, file: File | null) => {
    const novosTimes = [...times];
    novosTimes[index] = { ...novosTimes[index], escudoFile: file };
    setTimes(novosTimes);
  };

  const isFormValid = (): boolean => {
    if (!campeonatoNome.trim()) return false;
    return times.every((t) => t.nome.trim() !== '' && t.escudoFile !== null);
  };

  const handleSalvarTorneio = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const timesProcessados: Record<string, TimeProcessado> = {};

      for (let i = 0; i < 6; i++) {
        const time = times[i];
        
        if (!time.escudoFile) continue;

        // Converte a imagem para Base64 em vez de usar o Storage
        const base64Url = await converterParaBase64(time.escudoFile);

        timesProcessados[`time_${i + 1}`] = {
          id: `time_${i + 1}`,
          nome: time.nome,
          escudoUrl: base64Url,
          sets_vencidos: 0,
          total_pontos: 0
        };
      }

      await set(dbRef(db, 'torneio'), {
        config: {
          nome: campeonatoNome,
          status: 'aguardando_sorteio'
        },
        times: timesProcessados
      });

      // Redireciona automaticamente para a tela da tabela
      router.push('/tabela');
      
    } catch (error) {
      console.error("Erro ao salvar dados:", error);
      alert("Houve um erro ao processar os times. Verifique o console.");
      setLoading(false);
    } 
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Configuração do Campeonato</h1>
      
      <form onSubmit={handleSalvarTorneio}>
        <div className={styles.formGroup}>
          <label className={styles.label}>Nome do Campeonato</label>
          <input 
            type="text" 
            className={styles.input}
            placeholder="Ex: Taça Blumenau de Vôlei"
            value={campeonatoNome}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setCampeonatoNome(e.target.value)}
          />
        </div>

        <h2 className={styles.title} style={{marginTop: '40px', fontSize: '24px'}}>Cadastro de Times</h2>
        
        <div className={styles.teamGrid}>
          {times.map((time, index) => (
            <div key={index} className={styles.teamCard}>
              <h3 className={styles.teamTitle}>Time {index + 1}</h3>
              
              <div className={styles.formGroup}>
                <label className={styles.label}>Nome:</label>
                <input 
                  type="text" 
                  className={styles.input}
                  placeholder={`Ex: Apex Voleibol`}
                  value={time.nome}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleNameChange(index, e.target.value)}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Brasão/Logo:</label>
                <input 
                  type="file" 
                  accept="image/*"
                  className={styles.fileInput}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    const file = e.target.files ? e.target.files[0] : null;
                    handleFileChange(index, file);
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <button 
          type="submit" 
          className={styles.submitBtn}
          disabled={!isFormValid() || loading}
        >
          {loading ? 'Salvando...' : 'Cadastrar Times e Avançar'}
        </button>
      </form>
    </div>
  );
}