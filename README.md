# Progetto reti di calcolatori

/*Edit il 19/04/2021: Ho implementato il gioco degli scacchi con quasi tutte le sue funzionalità nei giorni seguenti alla pubblicazione di questo progetto. Pertanto oggi, 19/04/2021 ho pubblicato i nuovi file "server1.js" e "index1.js" che sono sostitutivi rispettivamente dei file "server.js" e "index.js". I vecchi file li ho comunque lasciati pubblicati.*/


1.Il progetto consiste in una web-app relativa al gioco degli scacchi. Gli utenti potranno giocare e chattare in rete, salvare in un database le proprie partite e recuperarle eventualmente in un secondo momento, salvare sul proprio google calendar eventuali tornei e scoprire in modo rapido chi sono gli utenti più visti che effettuano live di scacchi sulla piattaforma di twitch. Il progetto non è esente da bug ed è privo di alcune funzionalità previste nel classico gioco degli scacchi, come ad esempio mosse come arrocco o en passant, non essendo queste l'obiettivo principale del corso di reti di calcolatori. Pertanto chiamerò il gioco "scacchi semplificato".
Nel progetto, dovendolo testare, ho usato il localhost e la porta 3000 per il server, 5984 per il database(couchdb) instanziato con docker. Userò pertanto questi come riferimenti.
Per soddisfare i requisiti del progetto ho implementato:

-Due chiamate REST esterne, di cui una oauth e verso servizi esterni. Nel mio progetto vi è una chiamata verso la piattaforma twitch dalla quale si ottiene una stringa di 20 utenti della piattaforma che effettuano streaming di scacchi. L'altra chiamata REST serve per salvare su google calendar eventi di eventuali tornei di scacchi da svolgere sulla piattaforma.

-Utilizzo di websocket. Ho utilizzato i web-socket per realizzare un sistema di queue che smisterà i giocatori, il gioco degli scacchi online e una chat tra i giocatori che si sfidano.

-API REST da richiamare. La web-app offre a disposizione le partite giocate dai giocatori, possibilità di cancellare un utente con tutte le sue partite e possibilità di creare, eliminare e ottenere informazioni su eventuali tornei.

2.Per realizzare il lato server ho usato Nodejs. Basato su javascript è di tipo event-driven, ossia il flusso di esecuzione del programma non segue percorsi fissi come nella programmazione tradizionale ma dipende fortemente dal verificarsi di eventi. Questo lo rende adatto per applicazioni web. Per semplificare il routing(la risposta ad una richiesta del client verso un endpoint) ho utilizzato Express, un framework di nodejs. Per i websocket ho utilizzato la libreria Socket.io.



# INSTALL
Oltre al comando "npm install" devono essere installate 4 dipendenze:
```
npm install express: framework per i routing
npm install socket.io: libreria per websocket
npm install dotenv: il file .env permette di proteggere le informazioni sensibili
npm install request: serve per formulare chiamate http

Per funzionare la web-app ha bisogno di un database di supporto esterno. Una volta instanziato il database si deve modificare opportunamente la variabile url_db, modificando l'uri, l'admin, la password e la port.
```


# API

## Crea Torneo
```
GET     /creatorneo
Descrizione: Viene creato un torneo che abbia una stringa nome e una stringa data in questo formato d'esempio "2021-05-23T09:00:00-07:00" passati come parametro di tipo query.
Restituisce: 201
Restituisce:409 Error
```

## Prendi Torneo
```
GET     
/get/torneo
Descrizione: Viene restituito un torneo che abbia una stringa "nome" passato come parametro di tipo query.
Restituisce: 200 
{
  "_id": "string",
  "_rev": "string",
  "nome": "string",
  "date": "string"
}
Restituisce:405 invalid input
```
## Elimina Torneo
```
GET
/delete/torneo
Descrizione: Viene eliminato un torneo che abbia una stringa "nome" passata come parametro di tipo query.
Restituisce: 200
Restituisce: 404 Not found
```

## Prendi Partite
```
GET    /get/partite
Descrizione: Viene restituito un user con tutte le sue partite che abbia una stringa "nome" passata come parametro di tipo query
Restituisce:200 
{
  "_id": "string",
  "_rev": "string",
  "game": [
    {
      "time_game": 0,
      "Partita": "string"
    }
  ]
}
Restituisce: 405 Invalid input
```

## Elimina User
```
GET
/delete/user
Descrizione: Viene eliminato un user che abbia una stringa "nome" passata come parametro di tipo query.
Restituisce: 200
Restituisce: 404 Not found
```




# WEBSOCKET

-Collegandosi al link principale(nel mio caso http://localhost:3000) viene ricevuto un documento html ![homepage](https://user-images.githubusercontent.com/82471617/114623485-a2d4d880-9caf-11eb-8ca8-ce91cff336dc.png)

Per poter giocare a scacchi bisogna prima cercare un avversario cliccando sul tasto cerca.

![cerca_partita](https://user-images.githubusercontent.com/82471617/114625755-06acd080-9cb3-11eb-9aa3-77665d1345d3.jpg)

sul click del bottone "Cerca" viene emesso un messaggio che il server recepirà con socket.on('join_room'...

![crea_room](https://user-images.githubusercontent.com/82471617/114626632-49bb7380-9cb4-11eb-850e-476e67b05412.jpg)

Nella variabile queue verranno salvati gli identificatori di ogni socket delle connessioni e verranno inocodati i client in attesa di un avversario. Appena due client sono in coda verranno messi in una room virtuale tramite il comando socket.join(room), e rimarranno in comunicazione per tutta la durata della partita. In questa connessione vi è anche una chat con cui potranno comunicare. Se nel frattempo si connettono altri due giocatori essi verranno messi in comunicazione in un'altra room.


![2_room](https://user-images.githubusercontent.com/82471617/114628986-17ac1080-9cb8-11eb-9c74-55313f14ee7e.jpg)

Questo è un esempio di due partite che vengono gestite in contemporanea.

Per effettuare una mossa basterà cliccare sul pezzo che si vuole muovere e subito dopo cliccare dove si vuole muoverlo. Non è consentito muovere pezzi dell'avversario né muovere i propri pezzi durante il turno dell'avversario. Il proprio colore lo si può leggere a destra della scacchiera dove per "N0" indica nero e "B1" indica bianco. 
Alcune mosse non sono consentite(ad esempio il pedone muove sempre solo di una casella in avanti, ad esempio la classica apertura "E2-E4" non è stata ancora implementata, quindi non è consentita. "E2-E3" è riconosciuta valida invece.

A qualunque punto della partita si può salvare su un database esterno la partita, specificando un nome che sarà l'identificativo del documento che si andrà a creare sul database. Successivamente tramite il pulsante in fondo a tutto si potrà recuperare la partita con una chiamata get, specificando il nome dell'utente che sarà passato come parametro nella chiamata.

![Salva_partita](https://user-images.githubusercontent.com/82471617/114630359-b2a5ea00-9cba-11eb-9c50-52ae39c34aa6.jpg)
![salvapartita_code](https://user-images.githubusercontent.com/82471617/114630741-85a60700-9cbb-11eb-85fc-d462dd9399f0.jpg)
![salvapartita_code2](https://user-images.githubusercontent.com/82471617/114631058-2f859380-9cbc-11eb-9606-5c4f64341051.jpg)

Quando la partita viene salvata viene controllata se esiste già un documento relativo all'utente. Se non esiste bisogna crearlo. Se esiste allora si deve aggiornare il suo documento e aggiungere la partita al database, senza cancellare le partite precedenti. Inoltre se quella stessa partita è già stata salvata in un momento precedente, la si deve aggiornare sovrascrivendola, e non creando una "copia" superflua. Per far ciò per ogni partità viene salvata una variabile contenente l'istante di tempo in cui viene creata e servirà come identificatore della singola partita.

Per prelevare la partita, a seguito del click sul bottone sottostante verrà fatta una get che restituisce le partite di un utente in formato json.

# REST

Le altre funzionalità della web-app le si possono trovare cliccando nel menù soprastante su "tornei" e "Twitch Streamer Live".

Nelle funzioni da rendere sincrone, ovvero quelle per la quali si deve aspettare un dato o un processo affinché possano partire, per evitare di annidare troppe funzioni, utilizzo il sistema delle promise: attendo che una promessa sia soddisfatta prima di poter eseguire il compito successivo. Le promise nel progetto sono presenti ogni volta che vado ad fare operazioni sul database(come si è potuto notare precedentemente con la chiamata get_all), poiché voglio sapere la rev di ogni documento oltre ad altri dati contestuali prima di poter operare. Uso le promise anche quando vado ad eseguire il flusso delle chiamate REST su twitch e su google.
In Twitch Streamer Live verrà chiesto l'accesso, ma lo scope non è richiesto(questa specifica API twitch, Get Streams, non richiede alcuno scope).

![Twitchapi](https://user-images.githubusercontent.com/82471617/114667526-db040780-9cff-11eb-9c63-facee2b2c6b2.jpg)

Il flusso di come avviene una richiesta tramite API oauth è standard:

1.Viene chiesta l'autenticazione all'utente che verrà fatta sulla piattaforma dove è registrato(in questo caso è twitch) e generalmente ancheuna autorizzazione ad usare i dati per un determinato scopo(in questo caso come ho già detto è richiesta solo l'autenticazione)

![Twitch](https://user-images.githubusercontent.com/82471617/114633219-6eb5e380-9cc0-11eb-92ab-32c8cce166c4.jpg)

2.successivamente viene chiesto un token

3.si può accedere alle risorse utilizzando il token ricevuto.

La risposta sarà di questo tipo:

![StreamerTwitch](https://user-images.githubusercontent.com/82471617/114634529-03b9dc00-9cc3-11eb-813e-e9ea79f6d070.jpg)

Per l'API google il funzionamento è lo stesso. Andando su "Tornei", verranno mostrati i nomi di al massimo 3 tornei prelevati dal db e gli utenti possono salvarsi un promemoria sul proprio google calendar dell'evento.

![promemoria](https://user-images.githubusercontent.com/82471617/114878728-d5421b00-9e00-11eb-8477-8be1ea4eff35.jpg)

Il flusso è identico a quello delle API twitch. Vi sono due differenze: è richiesto lo scope(lettura e scrittura su calendar di calendari ed eventi), e prima di completare la scrittura su calendar bisogna prelevare i dati dal db, che non è necessariamente in locale.I passaggi dell'operazione sono:
1. Chiedo autenticazione e autorizzazione all utente
2. Chiedo token a google
3. Accedo a google calendar tramite il token per prelevare il calendario di cui l'utente è "owner"(altrimenti non avrei i permessi di scrittura)
4. Vado sul database della web-App e prelevo la data relativa al torneo selezionato dall'utente
5. uso il token per accedere a calendar e salvo un evento nella data prelevata.

![googleapi1](https://user-images.githubusercontent.com/82471617/114835024-71ecc480-9dd1-11eb-9760-6b6d782373b9.jpg)
![googleapi2](https://user-images.githubusercontent.com/82471617/114835046-774a0f00-9dd1-11eb-9c8c-bc6448c41ab8.jpg)


