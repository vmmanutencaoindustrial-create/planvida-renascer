// =========================================================
// Seed dos planos iniciais da PlanVida Renascer
// Rodar: npm run db:seed
// =========================================================
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const PLANOS = [
  {
    slug: 'individual',
    nome: 'Plano Individual',
    descricao: 'Pra quem cuida de si mesmo. Cobertura completa pro titular.',
    precoMensal: 170.00,
    beneficios: [
      '1 titular',
      'Urna funerária + velório 24h',
      'Translado em todo o Brasil',
      'Documentação completa',
      'Cremação OU sepultamento',
      'Atendimento 24h',
    ],
    destaque: false,
    ordem: 1,
  },
  {
    slug: 'familiar',
    nome: 'Plano Familiar',
    descricao: 'A escolha de 7 em cada 10 famílias atendidas pela PlanVida.',
    precoMensal: 290.00,
    beneficios: [
      'Titular + cônjuge',
      'Até 4 filhos (até 21 anos)',
      'Tudo do plano Individual',
      'Floricultura Renascer inclusa',
      'Centro Ambulatorial PlanVida',
      'Suporte familiar pós-perda',
    ],
    destaque: true,
    ordem: 2,
  },
  {
    slug: 'plus',
    nome: 'Plano Família Plus',
    descricao: 'Cobre até 3 gerações com um único plano.',
    precoMensal: 450.00,
    beneficios: [
      'Até 6 dependentes',
      'Inclui pais e sogros',
      'Tudo do plano Familiar',
      'Clínica odontológica gratuita',
      'Cobertura imediata por acidente',
      'Carteirinha digital + app',
    ],
    destaque: false,
    ordem: 3,
  },
];

async function main(){
  console.log('🌱 Seedando planos...');
  for(const plano of PLANOS){
    const result = await prisma.plan.upsert({
      where: { slug: plano.slug },
      create: plano,
      update: plano,
    });
    console.log(`  ✓ ${result.slug} (R$ ${result.precoMensal})`);
  }
  console.log('✅ Seed concluído.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
