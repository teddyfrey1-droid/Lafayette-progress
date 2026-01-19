const nodemailer = require("nodemailer");

async function main() {
  console.log("🤖 1. Démarrage du Robot...");

  const transport = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false,
    auth: {
      user: "9f9c88001@smtp-brevo.com", 
      pass: "bskRITXqoGxtW0X", 
    },
  });

  try {
    console.log("🔌 2. Connexion à Brevo...");
    await transport.verify();
    console.log("✅ SUCCÈS : Vos identifiants sont BONS !");
    
    console.log("📨 3. Envoi du mail...");
    const info = await transport.sendMail({
      from: "teddy.frey1@gmail.com", 
      to: "teddy.frey1@gmail.com",
      subject: "Test Robot Brevo N°2",
      text: "Si vous recevez ça, c'est que ça marche toujours !",
    });

    console.log("🚀 MAIL ENVOYÉ ! ID:", info.messageId);

  } catch (error) {
    console.error("❌ ERREUR :", error.message);
  }
}

main();
