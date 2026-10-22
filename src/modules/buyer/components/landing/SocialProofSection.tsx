import { motion } from 'motion/react';
import { Award, CheckCircle2, ShieldCheck, Star, Users } from 'lucide-react';
import { ACCREDITATION_BADGES, PATIENT_TESTIMONIALS } from './landingData';

const STAGGER_GRID = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.09, delayChildren: 0.04 },
  },
};

const ITEM_REVEAL = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: [0.16, 1, 0.3, 1] as const },
  },
};

export function SocialProofSection() {
  return (
    <section className="border-y border-slate-200/80 bg-white">
      {/* Franja de métricas de autoridad y prueba social */}
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <motion.div
          variants={STAGGER_GRID}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="grid grid-cols-2 gap-6 lg:grid-cols-4 lg:divide-x lg:divide-slate-200/80"
        >
          <motion.div variants={ITEM_REVEAL} className="space-y-1 lg:pr-6">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <Users className="h-4 w-4 text-[#0F766E]" aria-hidden />
              <span>Confianza clínica</span>
            </div>
            <p className="font-mono text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
              +12,400
            </p>
            <p className="text-xs text-slate-500">
              Pacientes rehabilitados en nuestras 3 sedes de Trujillo
            </p>
          </motion.div>

          <motion.div variants={ITEM_REVEAL} className="space-y-1 lg:px-6">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <div className="flex items-center text-amber-500" aria-hidden>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <span>Google Reviews</span>
            </div>
            <p className="font-mono text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
              4.9 <span className="text-base font-normal text-slate-400">/ 5.0</span>
            </p>
            <p className="text-xs text-slate-500">
              Basado en más de 1,850 reseñas verificadas de pacientes
            </p>
          </motion.div>

          <motion.div variants={ITEM_REVEAL} className="space-y-1 lg:px-6">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <ShieldCheck className="h-4 w-4 text-[#0F766E]" aria-hidden />
              <span>Índice de conformidad</span>
            </div>
            <p className="font-mono text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
              98.9%
            </p>
            <p className="text-xs text-slate-500">
              Alta clínica sin dolor postoperatorio ni retratamientos
            </p>
          </motion.div>

          <motion.div variants={ITEM_REVEAL} className="space-y-1 lg:pl-6">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <Award className="h-4 w-4 text-[#0F766E]" aria-hidden />
              <span>Puntualidad en sillón</span>
            </div>
            <p className="font-mono text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
              &lt; 8 min
            </p>
            <p className="text-xs text-slate-500">
              Tiempo promedio de espera en sala gracias a agenda bloqueada
            </p>
          </motion.div>
        </motion.div>

        {/* Grid de badges de acreditación médica y certificación de bioseguridad */}
        <div className="mt-10 border-t border-slate-100 pt-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.4 }}
            className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Acreditación médica y protocolos de bioseguridad
            </p>
            <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-medium text-[#065F46]">
              <CheckCircle2 className="h-3 w-3 text-[#0F766E]" aria-hidden />
              Auditoría sanitaria vigente 2026
            </span>
          </motion.div>

          <motion.div
            variants={STAGGER_GRID}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            {ACCREDITATION_BADGES.map((badge) => (
              <motion.div
                key={badge.code}
                variants={ITEM_REVEAL}
                whileHover={{ y: -3 }}
                className="flex flex-col justify-between rounded-xl border border-slate-200/80 bg-[#F8FAFC] p-4 transition-colors hover:border-teal-700/30 hover:bg-white hover:shadow-xs"
              >
                <div>
                  <span className="inline-block rounded-md bg-[#ECFDF5] px-2 py-0.5 font-mono text-[10.5px] font-semibold text-[#065F46]">
                    {badge.code}
                  </span>
                  <h3 className="mt-2.5 text-xs font-semibold text-slate-900">
                    {badge.title}
                  </h3>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500">
                    {badge.detail}
                  </p>
                </div>
                <p className="mt-3 border-t border-slate-200/60 pt-2 text-[10.5px] font-medium text-slate-400">
                  {badge.institution}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Sección de Testimonios Verificados */}
      <div id="testimonios" className="scroll-mt-20 border-t border-slate-100 bg-[#F8FAFC] py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.45 }}
            className="max-w-2xl"
          >
            <span className="inline-flex items-center rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-semibold text-[#065F46]">
              Experiencias Reales
            </span>
            <h2 className="mt-2.5 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Lo que valoran nuestros pacientes
            </h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Transparencia diagnóstica, respeto absoluto por tu tiempo y tratamientos pensados para durar.
            </p>
          </motion.div>

          <motion.div
            variants={STAGGER_GRID}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
            className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3"
          >
            {PATIENT_TESTIMONIALS.map((item) => (
              <motion.article
                key={item.name}
                variants={ITEM_REVEAL}
                whileHover={{ y: -4 }}
                className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs transition-colors hover:border-[#0F766E]/35 hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div
                      className="flex items-center gap-0.5 text-amber-400"
                      aria-label={`${item.rating} de 5 estrellas`}
                    >
                      {Array.from({ length: item.rating }).map((_, idx) => (
                        <Star key={idx} className="h-3.5 w-3.5 fill-amber-400" />
                      ))}
                    </div>
                    <span className="rounded-full bg-[#ECFDF5] px-2 py-0.5 text-[10.5px] font-medium text-[#065F46]">
                      Paciente verificado
                    </span>
                  </div>

                  <p className="mt-4 text-[13px] leading-relaxed text-slate-700">
                    “{item.quote}”
                  </p>
                </div>

                <div className="mt-5 border-t border-slate-100 pt-3.5">
                  <p className="text-xs font-semibold text-slate-900">{item.name}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {item.treatment} · <span className="font-medium text-[#0F766E]">{item.branch}</span>
                  </p>
                </div>
              </motion.article>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
