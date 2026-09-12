import { redirect } from 'next/navigation';

export default function Home() {
  // Redireciona automaticamente quem acessar a raiz (/) para a tela de configurações (/setup)
  redirect('/setup');
}