exports.createCommunityWizardStatus = (i18n, state) => {
  let { name, currencies, group, channels, fee, solvers } = state;
  name = state.name || '__';
  currencies = state.currencies && state.currencies.join(', ');
  currencies = currencies || '__';
  group = state.group || '__';
  channels =
    state.channels && state.channels.map(channel => channel.name).join(', ');
  channels = channels || '__';
  fee = state.fee || '__';
  solvers =
    state.solvers && state.solvers.map(solver => solver.username).join(', ');
  solvers = solvers || '__';
  const text = [
    `Nombre: ${name}`,
    `Moneda: ${currencies}`,
    `Grupo: ${group}`,
    `Canales: ${channels}`,
    `Comisión: ${fee}%`,
    `Solvers: ${solvers}`,

    state.error && `Error: ${state.error}`,
    ``,
    i18n.t('wizard_to_exit'),
  ].join('\n');

  return { text };
};
