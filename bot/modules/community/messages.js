exports.createCommunityWizardStatus = (i18n, state) => {
  let { name, currencies, group, channels, fee, solvers } = state;

  name = state.name || '__';
  currencies = state.currencies || '__';
  group = state.group || '__';
  channels = state.channels || '__';
  fee = state.fee + '%' || '__%';
  solvers = state.solvers || '__';

  const text = [
    `Nombre: ${name}`,
    `Moneda: ${currencies}`,
    `Grupo: ${group}`,
    `Canales: ${channels}`,
    `Comisión: ${fee}`,
    `Solvers: ${solvers}`,

    state.error && `Error: ${state.error}`,
    ``,
    i18n.t('wizard_to_exit'),
  ].join('\n');

  return { text };
};
