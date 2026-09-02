// =============================================================
// KOLO — BLOC C2 i18n : Dossier PDF (Avis de valeur)
// Copie figée FR (validée Message 512) + EN / IT / DE
// Aucune référence OCR (v1 = saisie manuelle).
// « L'essentiel » et « Tout le dossier » pour les deux niveaux.
// Bandeau incomplet gris neutre — jamais d'ambre (réservé à la veille).
// =============================================================

const dossier = {
  fr: {
    // Titres et navigation
    'dos.titre': "Avis de valeur",
    'dos.nouveau': "Nouveau dossier",
    'dos.liste.vide.titre': "Aucun dossier pour le moment.",
    'dos.liste.vide.sous': "Créez un dossier à partir d'une de vos estimations.",
    'dos.liste.rechercher': "Rechercher",

    // Sélecteur de niveau
    'dos.niveau.titre': "Niveau du dossier",
    'dos.niveau.1': "L'essentiel",
    'dos.niveau.1.sous': "Rapport prêt en deux minutes en sortie de visite.",
    'dos.niveau.2': "Tout le dossier",
    'dos.niveau.2.sous': "Dossier enrichi, à compléter après la visite.",

    // Bandeau « dossier incomplet » — gris neutre, jamais d'ambre
    'dos.incomplet.titre': "Dossier en cours",
    'dos.incomplet.texte': "Dossier en cours — complétez avant l'envoi",
    'dos.incomplet.cta': "Compléter",

    // Statuts
    'dos.statut.brouillon': "Brouillon",
    'dos.statut.complet': "Complet",
    'dos.statut.envoye': "Envoyé",
    'dos.statut.archive': "Archivé",

    // Sauvegarde hors ligne
    'dos.offline.saved': "Hors ligne — sauvegardé sur l'appareil",
    'dos.offline.sync': "Synchronisation en cours…",

    // Ajustement manuel — le motif apparaît dans le document
    'dos.ajust.titre': "Ajustement manuel",
    'dos.ajust.sous': "Le motif que vous saisissez apparaîtra dans le document, sous la valeur retenue.",
    'dos.ajust.motif': "Motif de l'ajustement",
    'dos.ajust.valeur': "Valeur retenue",

    // Mur rédacteur/agence (bloquant à l'export)
    'dos.mur.titre': "Complétez votre profil avant d'envoyer le dossier",
    'dos.mur.sous': "Ces informations figureront dans l'en-tête du document et dans les mentions légales.",
    'dos.mur.cta': "Compléter mon profil",

    // Sections (22) — libellés exactement identiques au schéma canonique
    'dos.section.dossier': "Identité du dossier",
    'dos.section.redacteur': "Rédacteur et agence",
    'dos.section.mission': "Demandeur et objet de la mission",
    'dos.section.identification': "Identification du bien",
    'dos.section.surfaces': "Surfaces",
    'dos.section.composition': "Composition et agencement",
    'dos.section.technique': "État technique",
    'dos.section.energie': "Énergie et diagnostics",
    'dos.section.copropriete': "Copropriété",
    'dos.section.charges_fiscalite': "Charges et fiscalité",
    'dos.section.environnement': "Environnement et localisation",
    'dos.section.marche': "Marché local",
    'dos.section.methode': "Méthode de valorisation",
    'dos.section.comparables': "Références comparables",
    'dos.section.ajustements': "Grille d'ajustement du bien",
    'dos.section.swot': "Atouts et points de vigilance",
    'dos.section.conclusion': "Conclusion de valeur",
    'dos.section.net_vendeur': "Simulation net vendeur",
    'dos.section.strategie': "Stratégie de commercialisation",
    'dos.section.mentions': "Mentions légales",
    'dos.section.annexes': "Annexes",
    'dos.section.signature': "Signature",

    // CTAs
    'dos.action.creer': "Créer le dossier",
    'dos.action.enregistrer': "Enregistrer",
    'dos.action.telecharger': "Télécharger le PDF",
    'dos.action.envoyer': "Envoyer par e-mail",
    'dos.action.dupliquer': "Dupliquer",
    'dos.action.archiver': "Archiver",
  },
};

dossier.en = {
  'dos.titre': "Property valuation",
  'dos.nouveau': "New report",
  'dos.liste.vide.titre': "No report yet.",
  'dos.liste.vide.sous': "Create a report from one of your estimates.",
  'dos.liste.rechercher': "Search",

  'dos.niveau.titre': "Report level",
  'dos.niveau.1': "The essentials",
  'dos.niveau.1.sous': "Report ready in two minutes at the end of the visit.",
  'dos.niveau.2': "Full report",
  'dos.niveau.2.sous': "Extended report to complete after the visit.",

  'dos.incomplet.titre': "Report in progress",
  'dos.incomplet.texte': "Report in progress — complete before sending",
  'dos.incomplet.cta': "Complete",

  'dos.statut.brouillon': "Draft",
  'dos.statut.complet': "Complete",
  'dos.statut.envoye': "Sent",
  'dos.statut.archive': "Archived",

  'dos.offline.saved': "Offline — saved on device",
  'dos.offline.sync': "Syncing…",

  'dos.ajust.titre': "Manual adjustment",
  'dos.ajust.sous': "The reason you enter will appear in the document, below the retained value.",
  'dos.ajust.motif': "Reason for the adjustment",
  'dos.ajust.valeur': "Retained value",

  'dos.mur.titre': "Complete your profile before sending the report",
  'dos.mur.sous': "This information will appear in the header of the document and in the legal notices.",
  'dos.mur.cta': "Complete my profile",

  'dos.section.dossier': "Report identity",
  'dos.section.redacteur': "Editor and agency",
  'dos.section.mission': "Client and purpose",
  'dos.section.identification': "Property identification",
  'dos.section.surfaces': "Surfaces",
  'dos.section.composition': "Composition and layout",
  'dos.section.technique': "Technical condition",
  'dos.section.energie': "Energy and diagnostics",
  'dos.section.copropriete': "Co-ownership",
  'dos.section.charges_fiscalite': "Charges and taxation",
  'dos.section.environnement': "Environment and location",
  'dos.section.marche': "Local market",
  'dos.section.methode': "Valuation method",
  'dos.section.comparables': "Comparable references",
  'dos.section.ajustements': "Adjustment grid",
  'dos.section.swot': "Strengths and warning points",
  'dos.section.conclusion': "Value conclusion",
  'dos.section.net_vendeur': "Net-to-seller simulation",
  'dos.section.strategie': "Marketing strategy",
  'dos.section.mentions': "Legal notices",
  'dos.section.annexes': "Appendices",
  'dos.section.signature': "Signature",

  'dos.action.creer': "Create report",
  'dos.action.enregistrer': "Save",
  'dos.action.telecharger': "Download PDF",
  'dos.action.envoyer': "Send by email",
  'dos.action.dupliquer': "Duplicate",
  'dos.action.archiver': "Archive",
};

dossier.it = {
  'dos.titre': "Parere di valore",
  'dos.nouveau': "Nuovo dossier",
  'dos.liste.vide.titre': "Nessun dossier per il momento.",
  'dos.liste.vide.sous': "Crea un dossier a partire da una tua stima.",
  'dos.liste.rechercher': "Cerca",

  'dos.niveau.titre': "Livello del dossier",
  'dos.niveau.1': "L'essenziale",
  'dos.niveau.1.sous': "Rapporto pronto in due minuti a fine visita.",
  'dos.niveau.2': "Dossier completo",
  'dos.niveau.2.sous': "Dossier arricchito, da completare dopo la visita.",

  'dos.incomplet.titre': "Dossier in corso",
  'dos.incomplet.texte': "Dossier in corso — completa prima dell'invio",
  'dos.incomplet.cta': "Completa",

  'dos.statut.brouillon': "Bozza",
  'dos.statut.complet': "Completo",
  'dos.statut.envoye': "Inviato",
  'dos.statut.archive': "Archiviato",

  'dos.offline.saved': "Offline — salvato sul dispositivo",
  'dos.offline.sync': "Sincronizzazione in corso…",

  'dos.ajust.titre': "Regolazione manuale",
  'dos.ajust.sous': "Il motivo inserito comparirà nel documento, sotto il valore adottato.",
  'dos.ajust.motif': "Motivo della regolazione",
  'dos.ajust.valeur': "Valore adottato",

  'dos.mur.titre': "Completa il tuo profilo prima di inviare il dossier",
  'dos.mur.sous': "Queste informazioni compariranno in intestazione e nelle menzioni legali.",
  'dos.mur.cta': "Completa il mio profilo",

  'dos.section.dossier': "Identità del dossier",
  'dos.section.redacteur': "Redattore e agenzia",
  'dos.section.mission': "Richiedente e oggetto",
  'dos.section.identification': "Identificazione del bene",
  'dos.section.surfaces': "Superfici",
  'dos.section.composition': "Composizione e distribuzione",
  'dos.section.technique': "Stato tecnico",
  'dos.section.energie': "Energia e diagnosi",
  'dos.section.copropriete': "Condominio",
  'dos.section.charges_fiscalite': "Spese e fiscalità",
  'dos.section.environnement': "Ambiente e localizzazione",
  'dos.section.marche': "Mercato locale",
  'dos.section.methode': "Metodo di valutazione",
  'dos.section.comparables': "Riferimenti comparabili",
  'dos.section.ajustements': "Griglia di regolazione",
  'dos.section.swot': "Punti forti e criticità",
  'dos.section.conclusion': "Conclusione di valore",
  'dos.section.net_vendeur': "Simulazione netto venditore",
  'dos.section.strategie': "Strategia commerciale",
  'dos.section.mentions': "Menzioni legali",
  'dos.section.annexes': "Allegati",
  'dos.section.signature': "Firma",

  'dos.action.creer': "Crea dossier",
  'dos.action.enregistrer': "Salva",
  'dos.action.telecharger': "Scarica il PDF",
  'dos.action.envoyer': "Invia via e-mail",
  'dos.action.dupliquer': "Duplica",
  'dos.action.archiver': "Archivia",
};

dossier.de = {
  'dos.titre': "Wertermittlung",
  'dos.nouveau': "Neues Dossier",
  'dos.liste.vide.titre': "Noch kein Dossier vorhanden.",
  'dos.liste.vide.sous': "Erstellen Sie ein Dossier aus einer Ihrer Schätzungen.",
  'dos.liste.rechercher': "Suchen",

  'dos.niveau.titre': "Detailtiefe",
  'dos.niveau.1': "Das Wesentliche",
  'dos.niveau.1.sous': "Bericht in zwei Minuten am Ende des Besuchs.",
  'dos.niveau.2': "Vollständiges Dossier",
  'dos.niveau.2.sous': "Ausführliches Dossier, nach dem Besuch zu vervollständigen.",

  'dos.incomplet.titre': "Dossier in Bearbeitung",
  'dos.incomplet.texte': "Dossier in Bearbeitung — vor dem Versand vervollständigen",
  'dos.incomplet.cta': "Vervollständigen",

  'dos.statut.brouillon': "Entwurf",
  'dos.statut.complet': "Vollständig",
  'dos.statut.envoye': "Gesendet",
  'dos.statut.archive': "Archiviert",

  'dos.offline.saved': "Offline — auf dem Gerät gespeichert",
  'dos.offline.sync': "Synchronisierung läuft…",

  'dos.ajust.titre': "Manuelle Anpassung",
  'dos.ajust.sous': "Der eingegebene Grund erscheint im Dokument unter dem angesetzten Wert.",
  'dos.ajust.motif': "Grund der Anpassung",
  'dos.ajust.valeur': "Angesetzter Wert",

  'dos.mur.titre': "Vervollständigen Sie Ihr Profil vor dem Versand",
  'dos.mur.sous': "Diese Angaben erscheinen im Kopf des Dokuments und in den rechtlichen Hinweisen.",
  'dos.mur.cta': "Profil vervollständigen",

  'dos.section.dossier': "Identität des Dossiers",
  'dos.section.redacteur': "Bearbeiter und Agentur",
  'dos.section.mission': "Auftraggeber und Zweck",
  'dos.section.identification': "Identifizierung der Immobilie",
  'dos.section.surfaces': "Flächen",
  'dos.section.composition': "Zusammensetzung und Grundriss",
  'dos.section.technique': "Technischer Zustand",
  'dos.section.energie': "Energie und Gutachten",
  'dos.section.copropriete': "Wohnungseigentum",
  'dos.section.charges_fiscalite': "Nebenkosten und Steuern",
  'dos.section.environnement': "Umgebung und Lage",
  'dos.section.marche': "Lokaler Markt",
  'dos.section.methode': "Bewertungsmethode",
  'dos.section.comparables': "Vergleichsobjekte",
  'dos.section.ajustements': "Anpassungsraster",
  'dos.section.swot': "Stärken und Achtungspunkte",
  'dos.section.conclusion': "Wertaussage",
  'dos.section.net_vendeur': "Simulation Nettoerlös Verkäufer",
  'dos.section.strategie': "Vermarktungsstrategie",
  'dos.section.mentions': "Rechtliche Hinweise",
  'dos.section.annexes': "Anlagen",
  'dos.section.signature': "Unterschrift",

  'dos.action.creer': "Dossier erstellen",
  'dos.action.enregistrer': "Speichern",
  'dos.action.telecharger': "PDF herunterladen",
  'dos.action.envoyer': "Per E-Mail senden",
  'dos.action.dupliquer': "Duplizieren",
  'dos.action.archiver': "Archivieren",
};

export default dossier;
