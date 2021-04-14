## Progetto reti di calcolatori

1.Il progetto consiste in una web-app relativa al gioco degli scacchi. Gli utenti potranno giocare e chattare in rete, salvare in un database le proprie partite e recuperarle eventualmente in un secondo momento, iscriversi ad eventuali tornei e scoprire in modo rapido chi sono gli utenti più visti che effettuano live di scacchi sulla piattaforma di twitch. Il progetto non è esente da bug ed è privo di alcune funzionalità previste nel classico gioco degli scacchi, come ad esempio mosse come arrocco o en passant, non essendo queste l'obiettivo principale del corso di reti di calcolatori. Pertanto chiamerò il gioco "scacchi semplificato".
Nel progetto, dovendolo testarer, ho usato il localhost e la porta 3000 per il server, 5984 per il database(couchdb) instanziato con docker. Userò pertanto questi come riferimenti.
Per soddisfare i requisiti del progetto ho implementato:
-Due chiamate REST esterne, di cui una oauth e verso servizi esterni. Nel mio progetto vi è una chiamata verso la piattaforma twitch dalla quale si ottiene una stringa di 20 utenti della piattaforma twitch che effettuano streaming di scacchi. L'altra chiamata REST serve per salvare su google calendar eventi di eventuali tornei di scacchi da svolgere sulla piattaforma, a cui gli utenti potranno anche iscriversi.
-utilizzo di websocket. Ho utilizzato i web-socket per realizzare un sistema di queue che smisterà i giocatori in base a determinati criteri, il gioco degli scacchi online e una chat tra i giocatori che si sfidano.
-API REST da richiamare. La web-app offre a disposizione le partite giocate dai giocatori e informazioni su eventuali tornei.

2.Per realizzare il lato server ho usato Nodejs. Basato su javascript è di tipo event-driven, ossia il flusso di esecuzione del programma non segue percorsi fissi come nella programmazione tradizionale ma dipende fortemente dal verificarsi di eventi. Questo lo rende adatto per applicazioni web. Per semplificare il routing(la risposta ad una richiesta del client verso un endpoint) ho utilizzato Express, un framework di nodejs. Per i websocket ho utilizzato la libreria Socket.io.


#WEBSOCKET

-Collegandosi al link principale viene ricevuto un documento html ![homepage](https://user-images.githubusercontent.com/82471617/114623485-a2d4d880-9caf-11eb-8ca8-ce91cff336dc.png)

Per poter giocare a scacchi bisogna prima cercare un avversario cliccando sul tasto cerca.

![cerca_partita](https://user-images.githubusercontent.com/82471617/114625755-06acd080-9cb3-11eb-9aa3-77665d1345d3.jpg)

sul click del bottone "Cerca" viene emesso un messaggio che il server recepirà con socket.on('join_room'...

![crea_room](https://user-images.githubusercontent.com/82471617/114626632-49bb7380-9cb4-11eb-850e-476e67b05412.jpg)

Nella variabile queue verranno salvati gli identificatori di ogni socket delle connessioni e verranno inocodati i client in attesa di un avversario. Appena due client sono in coda verranno messi in una room virtuale tramite il comando socket.join(room), e rimarranno in comunicazione per tutta la durata della partita. In questa connessione vi è anche una chat con cui potranno comunicare i due giocatori. Se nel frattempo si connettono altri due giocatori essi verranno messi in comunicazione in un'altra room.


![2_room](https://user-images.githubusercontent.com/82471617/114628986-17ac1080-9cb8-11eb-9c74-55313f14ee7e.jpg)

Questo è un esempio di due partite che vengono gestite in contemporanea. 

A qualunque punto della partita si può salvare su un database esterno la partita, specificando un nome che sarà l'identificativo del documento che si andrà a creare sul database. Successivamente tramite il pulsante in fondo a tutto si potrà recuperare la partita con una chiamata get, specificando il nome dell'utente che sarà passato come parametro nella chiamata.

![Salva_partita](https://user-images.githubusercontent.com/82471617/114630359-b2a5ea00-9cba-11eb-9c50-52ae39c34aa6.jpg)
![salvapartita_code](https://user-images.githubusercontent.com/82471617/114630741-85a60700-9cbb-11eb-85fc-d462dd9399f0.jpg)
![salvapartita_code2](https://user-images.githubusercontent.com/82471617/114631058-2f859380-9cbc-11eb-9606-5c4f64341051.jpg)

Quando la partita viene salvata viene controllata se esiste già un documento relativo all'utente(nel caso della immagine l'utente è DaddySoldoni). Se non esiste bisogna crearlo. Se esiste allora si deve aggiornare il suo documento e aggiungere la partita al database, senza cancellare le partite precedenti. Inoltre se quella stessa partita è già stata salvata in un momento precedente, la si deve aggiornare sovrascrivendola, e non creando una "copia" superflua. Per far ciò per ogni partità viene salvata una variabile contenente l'istante di tempo in cui viene creata e servirà come identificatore della singola partita.

Per prelevare la partita, a seguito del click sul bottone sottostante verrà fatta una get che restituisce le partite di un utente in formato json.

#REST

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

Per l'API google il funzionamento è lo stesso. Gli utenti possono salvarsi un promemoria sul proprio google calendar di un torneo che sarà svolto sulla web-app.

![promemoria](https://user-images.githubusercontent.com/82471617/114752511-a7a09780-9d56-11eb-8837-9b0a7e7ecf79.jpg)
