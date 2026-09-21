// Textes des e-mails de compte (fonction pure : aucune dependance, testable seule).
export function accountEmail(kind: 'invite' | 'reset' | 'forgot', p: { displayName: string; username: string; link: string; from?: string }) {
  const hours = kind === 'invite' ? 72 : kind === 'reset' ? 24 : 1
  const intro = kind === 'invite' ? `${p.from || 'L\'administrateur'} t'invite à utiliser LoussaHousing.`
    : kind === 'reset' ? `${p.from || 'L\'administrateur'} a demandé la réinitialisation de ton mot de passe LoussaHousing.`
      : 'Une demande de réinitialisation du mot de passe a été faite pour ton compte LoussaHousing.'
  const subject = kind === 'invite' ? 'Invitation à LoussaHousing' : 'Réinitialisation de ton mot de passe LoussaHousing'
  const ignore = kind === 'forgot' ? 'Si tu n\'es pas à l\'origine de cette demande, ignore ce message : ton mot de passe actuel reste valable.' : 'Si tu n\'attends pas ce message, ignore-le : personne ne pourra se connecter sans ce lien.'
  const text = `Bonjour ${p.displayName},\n\n${intro}\n\nIdentifiant : ${p.username}\n\nChoisis ${kind === 'invite' ? 'ton mot de passe' : 'un nouveau mot de passe'} avec ce lien personnel (à usage unique, valable ${hours === 1 ? '1 heure' : `${hours} heures`}) :\n${p.link}\n\n${ignore}\n`
  return { subject, text }
}
