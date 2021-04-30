require('dotenv').config();
const { kMaxLength } = require('buffer');
var express=require('express');
const { resolve } = require('path');
const { emit, nextTick } = require('process');
var app=express();
var request = require('request');
//HTTPS
var https=require('https');
const fs=require('fs');
const sslServer=https.createServer(
    {
        key: fs.readFileSync(__dirname+'/key.pem'),
        cert: fs.readFileSync(__dirname+'/cert.pem')
    },app
)
//----
//var http=require('http').Server(app);
var io =require('socket.io')(sslServer);
const url="https://localhost:3000";
const url_db="http://admin:admin@localhost:5984"

const Engine = require('node-uci').Engine

const client_id=process.env.GOOGLE_CLIENT_ID;
const client_secret=process.env.GOOGLE_CLIENT_SECRET;
const client_id_twitch=process.env.TWITCH_CLIENT_ID;
const client_secret_twitch=process.env.TWITCH_CLIENT_SECRET;

app.use(express.static('public'));

//-----------------------------------------------------------------------
//-------------------API-------------------------------------------------
//-----------------------------------------------------------------------

app.get('/creatorneo',function(req,res){
    var id=req.query.nome;
    var date=req.query.date;
    var obj = {
        nome: id,
        date:date 
     };
     var r=JSON.stringify(obj);
    request({
        url: url_db+'/tornei/'+id, 
        method: 'PUT',
        body:r
    }, function(error, response){
        if(error) {
            console.log(error);
        } else {
            res.send(response.statusCode+" ")
        }
    });
});

app.get('/delete/torneo',function(req,res){    
    res.redirect("/delete/document?nome="+req.query.nome+"&db=tornei");
});

app.get('/delete/user',function(req,res){    
    res.redirect("/delete/document?nome="+req.query.nome+"&db=users");
});

app.get('/get/torneo',function(req,res){
    
    if(req.query.nome==null) res.status(405).send('Invalid input');
    else get_all(req.query.nome,'tornei').then(function(all){
        if(all.error=="not_found") res.status(405).send('Invalid input');
        else res.json(all);
    });

});

app.get('/get/partite',function(req,res){

    if(req.query.nome==null || req.query.nome=="") res.status(405).send('Invalid input');
    else get_all(req.query.nome,'users').then(function(all){
        if(all.error=="not_found") res.status(405).send('Invalid input');
        else res.send(all);
    });

});

app.get('/tornei', function(req, res) {    
    res.sendFile(__dirname + '/tornei.html');
}); 



app.get('/', function(req, res) {    
    res.sendFile(__dirname + '/index1.html');
}); 


//------------------------------------------------------
//---------------API GOOGLE-----------------------------
//------------------------------------------------------

app.get('/torneo/promemoria',function(req,res){
    res.redirect("https://accounts.google.com/o/oauth2/v2/auth?scope=https://www.googleapis.com/auth/calendar&redirect_uri=http://localhost:3000/token/&response_type=code&client_id="+client_id+'&state='+req.query.nome_torneo);
});
                            // CHIEDO AUTORIZZAZIONE
app.get('/token', function(req, res) {
    var torneo=req.query.state;
    var formData = {
        code: req.query.code,
        client_id: client_id,
        client_secret: client_secret,
        redirect_uri: "http://localhost:3000/token/",
        grant_type: 'authorization_code'
    }                                            
                            //CHIEDO TOKEN
    request.post({url:'https://www.googleapis.com/oauth2/v4/token', form: formData}, function optionalCallback(err, httpResponse, body) {
      if (err) {
        return console.error('upload failed:', err);
      }
      //console.log('Upload successful!  Server responded with:', body);
      var info = JSON.parse(body);
      a_t = info.access_token;
      var options = {
        url: 'https://www.googleapis.com/calendar/v3/users/me/calendarList',
        headers: {
          'Authorization': 'Bearer '+a_t
          }
        };
                                //CONTROLLO CALENDARIO DOVE SALVARE EVENTO
        request(options, function callback(error, response, body) {
        if (!error && response.statusCode == 200) {
          var info = JSON.parse(body);
          var trovato=false;
          var calendar_Id;
          for(var i=0;i<info.items.length && !trovato;i++){
              if(info.items[i].accessRole=='owner'){
                  calendar_Id=info.items[i].id;
                  trovato=true;
              }
          }                           //RECUPERO IL NOME E LA DATA DEL TORNEO DA SALVARE SU GOOGLE CALENDAR
          get_all(torneo,"tornei").then(function(info){
              if(info.error=='not_found')
              {  
                res.status(404).send('Torneo cancellato');
                return;                  
              } 
            data={
                summary: info.nome,
                start: {
                    dateTime: info.date
                },
                end: {
                    dateTime: info.date
                }
            }
            g=JSON.stringify(data);
                                    //SALVO EVENTO
              request({
                url: 'https://www.googleapis.com/calendar/v3/calendars/'+calendar_Id+'/events/',
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer '+a_t
                    },
                 body: g
            }, function(error, response, body){
                if(error) {
                    console.log(error);
                } else {
                    //console.log(response.statusCode, body);
                    res.send(response.statusCode);
                }
            });
          });
          
          }
        else {
          console.log(error);
        }
        });
    });
});


//-----------------------------------------------------------------------
//---------------------------API TWITCH----------------------------------
//-----------------------------------------------------------------------

app.get('/s',function(req,res){
    res.redirect("https://id.twitch.tv/oauth2/authorize?response_type=code&client_id="+client_id_twitch+"&redirect_uri="+url+"/streams");
});



let get_twitch_token=function(req){
    return new Promise(function(resolve,reject){
        var formData = {
            code: req.query.code,
            client_id: client_id_twitch,
            client_secret: client_secret_twitch,
            redirect_uri: url+"/streams",
            grant_type: 'authorization_code'
        }
        request.post({url:'https://id.twitch.tv/oauth2/token', form: formData}, function optionalCallback(err, httpResponse, body) {
            if (err) {
                reject('upload failed:', err);
            }
            else resolve(JSON.parse(body));
        });
    });
};

//RICHIESTA SERVIZIO

app.get('/streams',function(req,res){
    get_twitch_token(req).then(function(info){
        a_t = info.access_token;
      var options = {
        url: 'https://api.twitch.tv/helix/streams?game_id=743',
        headers: {
          'Authorization': 'Bearer '+a_t,
          'Client-Id':client_id_twitch
          }
        };
        request(options, function callback(error, response, body) {
            if (!error && response.statusCode == 200) {
                var streamer="";
                temp=JSON.parse(body);
                for(i=0;i<20;i++){
                    streamer+='https://twitch.tv/'+temp.data[i].user_name+", \n";
                }
                res.send(streamer);
                }
            else res.send(console.log(resposnse.statusCode));
        });
    });
});


//------------------------------------------------------
//---------------CREATE DATABASE------------------------
//------------------------------------------------------

app.get('/createdb',function(req,res){
    console.log(req.query.db)
    
    request({
        url: url_db+"/"+req.query.db,
        method: 'PUT',
    }, function(error, response, body){
        if(error) {
            console.log(error);
        } else {
            res.send(response.statusCode+" "+body)
            //console.log(response.statusCode, body);
        }
    });
});

//------------------------------------------------------
//---------------DELETE DATABASE------------------------
//------------------------------------------------------

app.get('/delete/db',function(req,res){
    var id=req.query.nome;
    request({
        url: url_db+'/'+id, 
        method: 'DELETE',
    }, function(error, response){
        if(error) {
            console.log(error);
        } else {
            res.send(response.statusCode+" ")
            console.log(response.statusCode);
        }
    });   
});

//------------------------------------------------------
//---------------DELETE DOCUMENT DATABASE---------------
//------------------------------------------------------

app.get('/delete/document',function(req,res){
    var id=req.query.nome;
    var db=req.query.db;
    get_all(id,db).then(function(all){
        console.log(all);
        request({
            url: url_db+'/'+db+'/'+id, 
            qs:{rev:all._rev},
            method: 'DELETE',
        }, function(error, response){
            if(error) {
                console.log(error);
            } else {
                res.send(response.statusCode+" ")
                console.log(response.statusCode);
            }
        });
    });      
});

//------------------------------------------------------
//---------------PROMISE GET FUNCTION----------
//------------------------------------------------------

let get_all=function(id,db){
    return new Promise(function(resolve,reject){
    request({
        url: url_db+'/'+db+'/'+id,
        method: 'GET',
    }, function(error, response, body){
            if(error){
                console.log(error);
                reject();
            } else{
                resolve(JSON.parse(body));
            }
        });
    });
};

//------------------------------------------------------
//---------------PUT FUNCTION---------------------------
//------------------------------------------------------

let put_doc=function(id,revision,req) {
    request({
        url: url_db+'/users/'+id, 
        qs:{rev:revision},
        method: 'PUT',
        body: req,
    }, function(error, response){
        if(error) {
            console.log(error);
        } else {
            return(response.statusCode+" ")
            console.log(response.statusCode);
        }
    });
}

//------------------------------------------------------
//---------------PUT DOCUMENT DATABASE------------------
//------------------------------------------------------

app.get('/put_document',function(req,res){
    var id=req.query.nome;
    var r=JSON.stringify(req.query);
    get_all(id,users).then(function(all){
        console.log(all);
        res.send(put_doc(id,all._rev,r));
    });
      
});



//------------------------------------------------------
//---------------WEBSOCKET CLIENT-----------------------
//------------------------------------------------------
var log=["","","","","","","","","",""];
var queue=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];

io.on('connection', function(socket) {
    var room=-1;
    var contatore_mossa=-1;
    var time_game= Date.now();
    //var array_pezzi=[2][16];
    socket.on('join_room',function(){
        if(room==-1){
            room=0;
            for(var i=0;i<queue.length;i++){
                if(queue[i]==0){
                    if(i%2==1){
                        room=i-1;
                        socket.join(room);
                        io.sockets.to(room).emit('inizio',room);
                        var casual=Math.floor((Math.random() * 10));
                        if(casual%2==0) {
                            queue[room+1]=socket.id;
                        }
                        else{
                            queue[room+1]=queue[room];
                            queue[room]=socket.id;
                        }
                        log[room]=0;
                        io.sockets.to(queue[room]).emit('chi_inizia',data={
                            make_turn:"1",
                            mio_colore:"B"
                            });
                        io.sockets.to(queue[room+1]).emit('chi_inizia',data={
                            make_turn:"0",
                            mio_colore:"N"
                            });
                        scacchiera=[[T0N=new Torre(0,0,"N"), C0N=new Cavallo(0,1,"N"), A0N=new Alfiere(0,2,"N"), RN=new Regina(0,3,"N"), KN=new Re(0,4,"N"), A1N=new Alfiere(0,5,"N"), C1N=new Cavallo(0,6,"N"), T1N=new Torre(0,7,"N")],
                                        [P0N=new Pedone(1,0,"N"), P1N=new Pedone(1,1,"N"), P2N=new Pedone(1,2,"N"), P3N=new Pedone(1,3,"N"), P4N=new Pedone(1,4,"N"), P5N=new Pedone(1,5,"N"), P6N=new Pedone(1,6,"N"), P7N=new Pedone(1,7,"N")],
                                        [new Pezzo(2,0,"O"), new Pezzo(2,1,"O"), new Pezzo(2,2,"O"), new Pezzo(2,3,"O"), new Pezzo(2,4,"O"), new Pezzo(2,5,"O"), new Pezzo(2,6,"O"), new Pezzo(2,7,"O")],
                                        [new Pezzo(3,0,"O"), new Pezzo(3,1,"O"), new Pezzo(3,2,"O"), new Pezzo(3,3,"O"), new Pezzo(3,4,"O"), new Pezzo(3,5,"O"), new Pezzo(3,6,"O"), new Pezzo(3,7,"O")],
                                        [new Pezzo(4,0,"O"), new Pezzo(4,1,"O"), new Pezzo(4,2,"O"), new Pezzo(4,3,"O"), new Pezzo(4,4,"O"), new Pezzo(4,5,"O"), new Pezzo(4,6,"O"), new Pezzo(4,7,"O")],
                                        [new Pezzo(5,0,"O"), new Pezzo(5,1,"O"), new Pezzo(5,2,"O"), new Pezzo(5,3,"O"), new Pezzo(5,4,"O"), new Pezzo(5,5,"O"), new Pezzo(5,6,"O"), new Pezzo(5,7,"O")],
                                        [P0B=new Pedone(6,0,"B"), P1B=new Pedone(6,1,"B"), P2B=new Pedone(6,2,"B"), P3B=new Pedone(6,3,"B"), P4B=new Pedone(6,4,"B"), P5B=new Pedone(6,5,"B"), P6B=new Pedone(6,6,"B"), P7B=new Pedone(6,7,"B")],
                                        [T0B=new Torre(7,0,"B"), C0B=new Cavallo(7,1,"B"), A0B=new Alfiere(7,2,"B"), RB=new Regina(7,3,"B"), KB=new Re(7,4,"B"), A1B=new Alfiere(7,5,"B"), C1B=new Cavallo(7,6,"B"), T1B=new Torre(7,7,"B")]];
                        array=[[T0N,C0N,A0N,RN,A1N,C1N,T1N,P0N,P1N,P2N,P3N,P4N,P5N,P6N,P7N,KN],
                                    [T0B,C0B,A0B,RB,A1B,C1B,T1B,P0B,P1B,P2B,P3B,P4B,P5B,P6B,P7B,KB]];
                    }
                    else{
                        room=i;
                        queue[room]=socket.id;
                        socket.join(room);
                    }
                    i=queue.length;
                }
            }
        }
    });

    socket.on('inizializza_contatore_nero',function(){
        contatore_mossa ++ ;
    });

    socket.on('salva_partita',function(nome){

        var obj = {
            game: []
         };
         obj.game.push({time_game: time_game, Partita:log[room]}); 
        get_all(nome,"users").then(function(all){
            let i=0;
            if(all.error!='not_found'){
                console.log(all);
                for(i=0;i<all.game.length && all.game[i].time_game!=time_game;i++){
                }
                if(i<all.game.length && all.game[i].time_game==time_game)all.game.splice(i,1);
                all.game.push({time_game: time_game, Partita:log[room]});
                obj=all;
            }                    
            var r = JSON.stringify(obj);
            console.log(put_doc(nome,all._rev,r));
        });
    });
    socket.on("disconnect", () => {
        io.sockets.to(room).emit('vittoria');
        queue[room]=0;
        queue[room+1]=0;
      });
    socket.on('on_move',function(data){
        mossa_consentita=true;
        matto=false;
        mangiabile=false;
        scacco=false;
        stallo=false;
        promozione=false;
        var move="";
        x_in=Math.floor(data.partenza/8),y_in=data.partenza%8;
        x_out=Math.floor(data.arrivo/8),y_out=data.arrivo%8;
        
        let muovi=function(a){
            if(!mossa_consentita)return;
            else if(matto)io.sockets.to(room).emit('matto',new_data={
                partenza:data.partenza,
                arrivo:data.arrivo,
                tipo:data.tipo,
                colore:colore});
            else if(stallo)io.sockets.to(room).emit('stallo');
            else{
                var cont=0;
                var fen="";
                for(i=0;i<8;i++){
                    cont=0;
                    for(j=0;j<8;j++){
                        color=scacchiera[i][j].prendi_colore();
                        tip=scacchiera[i][j].prendi_tipo();
                        if(tip=="Torre" && color=="N"){
                            if(cont!=0){
                                fen+=cont;
                                cont=0; 
                            }
                            fen+="r"
                        }
                        else if(tip=="Cavallo" && color=="N"){
                            if(cont!=0){
                                fen+=cont;
                                cont=0; 
                            }
                            fen+="n"
                        }
                        else if(tip=="Alfiere" && color=="N"){
                            if(cont!=0){
                                fen+=cont;
                                cont=0; 
                            }
                            fen+="b"
                        }
                        else if(tip=="Regina" && color=="N"){
                            if(cont!=0){
                                fen+=cont;
                                cont=0; 
                            }
                            fen+="q"
                        }
                        else if(tip=="Re" && color=="N"){
                            if(cont!=0){
                                fen+=cont;
                                cont=0; 
                            }
                            fen+="k"
                        }
                        else if(tip=="Pedone" && color=="N"){
                            if(cont!=0){
                                fen+=cont;
                                cont=0; 
                            }
                            fen+="p"
                        }
                        else if(tip=="Torre" && color=="B"){
                            if(cont!=0){
                                fen+=cont;
                                cont=0; 
                            }
                            fen+="R"
                        }
                        else if(tip=="Cavallo" && color=="B"){
                            if(cont!=0){
                                fen+=cont;
                                cont=0; 
                            }
                            fen+="N"
                        }
                        else if(tip=="Alfiere" && color=="B"){
                            if(cont!=0){
                                fen+=cont;
                                cont=0; 
                            }
                            fen+="B"
                        }
                        else if(tip=="Regina" && color=="B"){
                            if(cont!=0){
                                fen+=cont;
                                cont=0; 
                            }
                            fen+="Q"
                        }
                        else if(tip=="Re" && color=="B"){
                            if(cont!=0){
                                fen+=cont;
                                cont=0; 
                            }
                            fen+="K"
                        }
                        else if(tip=="Pedone" && color=="B"){
                            if(cont!=0){
                                fen+=cont;
                                cont=0; 
                            }
                            fen+="P"
                        }
                        else cont++;
                    }
                    if(cont!=0)fen+=cont+"/";
                    else fen+="/";
                }
                if(colore=="B")fen+=" b";
                else fen+=" w";
                /*********STOCKFISH ENGINE*********/
                const engine = new Engine('stockfish_13_win_x64_bmi2')
                engine
                .chain()
                .init()
                .setoption('MultiPV', 3)
                .position(fen)
                .go({ depth: 5 })
                .then(result => {
                    var linea=["","",""];
                    l=result.info.length
                    for(i=2; i>=0;i--){
                        linea[i]=result.info[l-1].pv;
                        l--;
                    }
                    io.sockets.to(room).emit('next_move',new_data={
                    partenza:data.partenza,
                    arrivo:data.arrivo,
                    tipo:data.tipo,
                    last_move:move,
                    scacco:scacco,
                    colore:colore,
                    promozione:promozione,
                    linea:linea
                });
                promozione=false;
                })
                /*******************/
            } 
        }
        let mossa=new Promise(function(resolve,reject){
            if(mossa_consentita){
                mantieni_partita(data.partenza,data.arrivo,data.tipo).then(function(last_move){
                    move=last_move;
                    resolve("");
                    new_data={
                        partenza:data.partenza,
                        arrivo:data.arrivo,
                        tipo:data.tipo,
                        last_move:last_move,
                        scacco:scacco
                    }                     
                })
            }
        });
        let noone_can_move=function(array,riga, scacchiera){
            for(var g=0;g<16;g++){
                if(array[riga][g].can_move(scacchiera))return false;
            }
            return true;
        }
        //VEDO SE LA MOSSA E' POSSIBILE
        if(scacchiera[x_in][y_in].possible_move(x_out,y_out,scacchiera)){
            var colore=scacchiera[x_in][y_in].prendi_colore();            
            if(colore=="B"){
                make_move=1;
                wait_move=0;
            }
            else{
                make_move=0;
                wait_move=1;
            }
            k_active_xy=array[make_move][15];
            k_passive_xy=array[wait_move][15];
            temp=scacchiera[x_out][y_out];
            temp.set_morto();
            scacchiera[x_in][y_in].pezzoMoveOn(x_in,y_in,x_out,y_out,scacchiera);
            //console.log(scacchiera[x_out][y_out]);
                // VEDO SE L AVVERSARIO MI DA SCACCO DOPO LA MOSSA
            for(k=0;k<15&&mossa_consentita;k++){
                if(array[wait_move][k].possible_move(k_active_xy.x,k_active_xy.y,scacchiera))mossa_consentita=false;
            }
            
            if(mossa_consentita){
                // VEDIAMO SE NOI DIAMO SCACCO
                for(k=0;k<15&&!scacco;k++){
                    if(array[make_move][k].possible_move(k_passive_xy.x,k_passive_xy.y,scacchiera))scacco=true;
                }
                if(scacco){
                    matto=true;
                    //DIAMO SCACCO. DOBBIAMO VEDERE SE IL RE AVVERSIARIO SI PUO MUOVERE 
                    //OPPURE IL PEZZO CHE DA SCACCO PUO ESSERE MANGIATO 
                    //OPPURE PUO ESSERE COPERTO IL PATH
                    if(array[wait_move][15].can_move(scacchiera))matto=false;
                    else matto=true;
                    if(matto){
                        //IL RE NON SI PUO MUOVERE VEDIAMO SE QUALCUNO PUO MANGIARE
                        for(k=0;k<15 && matto;k++){
                            if(array[wait_move][k].possible_move(x_out,y_out,scacchiera))matto=falso;
                        }
                        if(!matto){
                            //NESSUNO PUO MANGIARE, VEDIAMO SE QUALCUNO SI PUO' METTERE DAVANTI AL RE
                            //SE E' UN CAVALLO O UN PEDONE RINUNCIA.
                            if(scacchiera[x_out][y_out].prendi_tipo()!="Cavallo" && scacchiera[x_out][y_out].prendi_tipo()!="Pedone"){
                                //E' UNA TORRE
                                if(x_out==k_passive_xy.x){
                                    if(y_out>k_passive_xy.y){
                                        new Promise((resolve, reject) => {
                                            for(k=y_out-1;k>k_passive_xy.y && matto;k--){
                                                for(p=0;p<15 && matto;p++){
                                                    if(array[wait_move][p].possible_move(x_out,k,scacchiera))matto=false;
                                                }
                                            }
                                        }).finally(() => mossa.then(a=>muovi(a)))
                                    }
                                    else{
                                        new Promise((resolve, reject) => {
                                            for(k=y_out+1;k<k_passive_xy.y && matto;k++){
                                                for(p=0;p<15 && matto;p++){
                                                    if(array[wait_move][p].possible_move(x_out,k,scacchiera))matto=false;
                                                }
                                            }
                                        }).finally(() => mossa.then(a=>muovi(a)))
                                    }
                                }
                                else if(y_out==k_passive_xy.y){
                                    //E' UNA TORRE
                                    if(x_out>k_passive_xy.x){
                                        for(k=x_out-1;k>k_passive_xy.x && matto;k--){
                                            for(p=0;p<15 && matto;p++){
                                                if(array[wait_move][p].possible_move(k,y_out,scacchiera))matto=false;
                                            }
                                        }
                                        mossa.then(a=>muovi(a));
                                    }
                                    else{
                                        for(k=x_out+1;k<k_passive_xy.x && matto;k++){
                                            for(p=0;p<15 && matto;p++){
                                                if(array[wait_move][p].possible_move(k,y_out,scacchiera))matto=false;
                                            }
                                        }
                                        mossa.then(a=>muovi(a));
                                    }
                                }
                                else{
                                    //E' UN ALFIERE
                                    if(x_out<k_passive_xy.x){
                                        //1° quadrante
                                        if(y_out>k_passive_y){
                                            for(k=1;x_out+k<k_passive_xy.x && matto;k++){
                                                for(p=0;p<15 && matto;p++){
                                                    if(array[wait_move][p].possible_move(x_out+k,y_out-k,scacchiera))matto=false;
                                                }
                                            }
                                            mossa.then(a=>muovi(a));
                                        }
                                        //2° quadrante
                                        else{
                                            for(k=1;x_out+k<k_passive_xy.x && matto;k++){
                                                for(p=0;p<15 && matto;p++){
                                                    if(array[wait_move][p].possible_move(x_out+k,y_out+k,scacchiera))matto=false;
                                                }
                                            }
                                            mossa.then(a=>muovi(a));
                                        }
                                    }
                                    else{
                                        //3° quadrante
                                        if(y_out<k_passive_xy){
                                            for(k=1;x_out-k>k_passive_xy.x && matto;k++){
                                                for(p=0;p<15 && matto;p++){
                                                    if(array[wait_move][p].possible_move(x_out-k,y_out+k,scacchiera))matto=false;
                                                }
                                            }
                                            mossa.then(a=>muovi(a));
                                        }
                                        //4° quadrante
                                        else{
                                            for(k=1;x_out-k>k_passive_xy.x && matto;k++){
                                                for(p=0;p<15 && matto;p++){
                                                    if(array[wait_move][p].possible_move(x_out-k,y_out-k,scacchiera))matto=false;
                                                }
                                            }
                                            mossa.then(a=>muovi(a));
                                        }
                                    }
                                }
                            }
                            else mossa.then(a=>muovi(a));
                        }
                        else mossa.then(a=>muovi(a));
                    }
                    else{
                        //NON E' MATTO SOLO SCACCO
                        mossa.then(a=>muovi(a));
                    }
                }
                //MOSSA CONSENTITA MA NON E' SCACCO
                else{
                    //VEDIAMO SE E' STALLO
                    if(noone_can_move(array,wait_move,scacchiera)){
                        stallo=true;
                        mossa.then(a=>muovi(a));
                    }
                    else mossa.then(a=>muovi(a));
                }
            }
            else{
                //NON E' POSSIBILE LA MOSSA
                scacchiera[x_out][y_out].pezzoMoveOut(x_in,y_in,x_out,y_out,temp,scacchiera);
                temp.set_vivo();
                mossa.then(a=>muovi(a));
            }            
        }
        else return;
        

    });
    socket.on('chat',function(data){
        io.sockets.to(room).emit('chat',data);
    })

    let mantieni_partita=async function(pos_init,pos_fine,tipo){
        return new Promise(function(resolve,reject){
            contatore_mossa+=2;
            var pezzo;
            if(tipo=='fas fa-chess-pawn') 
            pezzo="pedone";
            else if(tipo=='fas fa-chess-rook') 
            pezzo="torre";
            else if(tipo=='fas fa-chess-bishop') 
            pezzo="alfiere";
            else if(tipo=='fas fa-chess-knight') 
            pezzo="cavallo";
            else if(tipo=='fas fa-chess-king') 
            pezzo="re";
            else if(tipo=='fas fa-chess-queen') 
            pezzo="regina";
            var x_init,y_init,x_fine,y_fine,col;
            x_init=8-(Math.floor(pos_init/8));
            if(pos_init%8==0)y_init='A';
            if(pos_init%8==1)y_init='B';
            if(pos_init%8==2)y_init='C';
            if(pos_init%8==3)y_init='D';
            if(pos_init%8==4)y_init='E';
            if(pos_init%8==5)y_init='F';
            if(pos_init%8==6)y_init='G';
            if(pos_init%8==7)y_init='H';
            x_fine=8-(Math.floor(pos_fine/8));
            if(pos_fine%8==0)y_fine='A';
            if(pos_fine%8==1)y_fine='B';
            if(pos_fine%8==2)y_fine='C';
            if(pos_fine%8==3)y_fine='D';
            if(pos_fine%8==4)y_fine='E';
            if(pos_fine%8==5)y_fine='F';
            if(pos_fine%8==6)y_fine='G';
            if(pos_fine%8==7)y_fine='H';
            if(socket.id==queue[room]) col="bianco";
            else col="nero";
            var last_move=contatore_mossa+" "+col+": "+pezzo+" "+y_init+x_init+" va in "+y_fine+x_fine+" ";
            log[room]+=last_move;
            resolve(last_move);
        });
    }

    socket.on('chiedi_tornei',function(){
        get_all("_all_docs","tornei").then(function(all){
            array_tornei=[]
            lun=all.rows.length;
            if(lun==0) {
               socket.emit('dai_tornei',data_tornei={
                dbvuoto: true
                }) 
            }
            else {
                for(j=0;j<lun && j<3;j++){
                    array_tornei[j]=all.rows[j].id;
                }
                data_tornei={
                    dbvuoto: false,
                    array :array_tornei
                    }
                socket.emit('tornei',data_tornei) ;
            }
        });
      });

});

/*

00 01 02 03 04 05 06 07
10 11 12 13 14 15 16 17
20 21 22 23 24 25 26 27
30 31 32 33 34 35 36 37
40 41 42 43 44 45 46 47
50 51 52 53 54 55 56 57
60 61 62 63 64 65 66 67
70 71 72 73 74 75 76 77





*/

class Pezzo{
    constructor(x,y,colore){
        this.x=x;
        this.y=y;
        this.colore=colore;
        this.tipo="";
        this.morto=false;
    }
    is_morto(){
        if(this.morto) return true;
        else return false;
    }
    set_morto(){
        this.morto=true;
    }
    set_vivo(){
        this.morto=false;
    }
    prendi_colore(){
        return this.colore;
    }
    opposite_colore(){
        if(this.colore=="B") return "N";
        else if(this.colore=="N")return "B";
        else this.colore;
    }
    prendi_tipo(){
        return this.tipo;
    }
    modifica_xy(x,y){
        this.x=x;
        this.y=y;
    }
    prendi_xy(){
        return {x:this.x,y:this.y};
    }
    sottoScaccoOnChange(pezzo_da_muovere,temp,pezzo_da_controllare,i,j,scacchiera){
        temp_x=pezzo_da_muovere.x;
        temp_y=pezzo_da_muovere.y;
        this.pezzoMoveOn(pezzo_da_muovere.x,pezzo_da_muovere.y,i,j,scacchiera);
        if(pezzo_da_controllare.sottoscacco.x==-1){
            this.pezzoMoveOut(temp_x,temp_y,i,j,temp,scacchiera);
            return true;
        }
        else pezzoMoveOut(temp_x,temp_y,i,j,temp,scacchiera);
        return false
    }
    pezzoMoveOn(x_in,y_in,x_out,y_out,scacchiera){
        scacchiera[x_out][y_out]=scacchiera[x_in][y_in];
        scacchiera[x_in][y_in]=new Pezzo(x_in,y_in,"O");
        scacchiera[x_out][y_out].modifica_xy(x_out,y_out);
    }
    pezzoMoveOut(x_in,y_in,x_out,y_out,temp,scacchiera){
        scacchiera[x_out][y_out].modifica_xy(x_in,y_in);
        scacchiera[x_in][y_in]=scacchiera[x_out][y_out];
        scacchiera[x_out][y_out]=temp;
    }
    difeso(array,riga,scacchiera){
        for(var i=0;i<16;i++){
            console.log(array[riga][i]," : ",array[riga][i].protegge(this.x,this.y,scacchiera))
            if(array[riga][i].protegge(this.x,this.y,scacchiera))return true;
        }
        return false;     
    }
}

class Pedone extends Pezzo{
    constructor(x,y,colore){
        super(x,y,colore);
        this.tipo="Pedone";
    }
    protegge(x_fine,y_fine,scacchiera){
        if(this.is_morto()) return false
        //Se il colore è bianco può sportarsi solo decrementando le x, se nero x deve essere incrementata
        else if((this.colore=="B" && (this.x-x_fine==1 || (this.x-x_fine==2 && this.x==6)))||((this.colore=="N")&& (this.x-x_fine==-1 || (this.x-x_fine==-2 && this.x==1)))){
            if((this.y-y_fine)**2==1)return true;
        }
        else return false;
    }
    possible_move(x_fine,y_fine,scacchiera){
        if(this.is_morto()) return false
        //Se il colore è bianco può sportarsi solo decrementando le x, se nero x deve essere incrementata   ***DA RIVEDERE LA MANGIATA IN DIAGONALE***
        else if((this.colore=="B" && (this.x-x_fine==1 || (this.x-x_fine==2 && this.x==6 &&scacchiera[x_fine][y_fine].prendi_colore()=="O")))||((this.colore=="N")&& (this.x-x_fine==-1 || (this.x-x_fine==-2 && this.x==1 && scacchiera[x_fine][y_fine].prendi_colore()=="O")))){
            if((this.y-y_fine==0 && scacchiera[x_fine][y_fine].prendi_colore()=="O")||((this.y-y_fine)**2==1 && scacchiera[x_fine][y_fine].prendi_colore()==this.opposite_colore()))return true;
        }
        else return false;
    }
    can_move(scacchiera){
        if(this.is_morto())return false;
        else if(this.colore=="B" && this.x+1<8){
            if(scacchiera[this.x+1][this.y].prendi_colore()=="O")return true;
            if(this.y-1>=0 && scacchiera[this.x+1][this.y-1].prendi_colore()=="N")return true;
            if(this.y+1<8 && scacchiera[this.x+1][this.y+1].prendi_colore()=="N")return true;
        }
        else if(this.colore=="N" && this.x-1>=0){
            if(scacchiera[this.x-1][this.y].prendi_colore()=="O")return true;
            if(this.y-1>=0 && scacchiera[this.x-1][this.y-1].prendi_colore()=="B")return true;
            if(this.y+1<8 && scacchiera[this.x-1][this.y+1].prendi_colore()=="B")return true;
        }
        else return false
    }
}
class Cavallo extends Pezzo{
    constructor(x,y,colore){
        super(x,y,colore);
        this.tipo="Cavallo";
    }
    protegge(x_fine,y_fine,scacchiera){
        if(this.is_morto()) return false
        //Basta che si muove ad L e che non ci sia un pezzo dello stesso colore alla fine
        else if((((this.x-x_fine)**2==4 && (this.y-y_fine)**2==1)||((this.y-y_fine)**2==4 && (this.x-x_fine)**2==1)))
        return true;
        else return false;
    }
    possible_move(x_fine,y_fine,scacchiera){
        if(this.is_morto()) return false
        //Basta che si muove ad L e che non ci sia un pezzo dello stesso colore alla fine
        else if((((this.x-x_fine)**2==4 && (this.y-y_fine)**2==1)||((this.y-y_fine)**2==4 && (this.x-x_fine)**2==1))&&scacchiera[x_fine][y_fine].prendi_colore()!=this.colore)
        return true;
        else return false;
    }
    can_move(scacchiera){
        if(this.is_morto()) return false
        //Basta che si muove ad L e che non ci sia un pezzo dello stesso colore alla fine
        else if(this.x-1>=0 && this.y+2<8 && scacchiera[this.x-1][this.y+2].prendi_colore()!=this.colore)return true;
        else if(this.x-2>=0 && this.y+1<8 && scacchiera[this.x-2][this.y+1].prendi_colore()!=this.colore)return true;
        else if(this.x-1>=0 && this.y-2>=0 && scacchiera[this.x-1][this.y-2].prendi_colore()!=this.colore)return true;
        else if(this.x-2>=0 && this.y-1>=0 && scacchiera[this.x-2][this.y-1].prendi_colore()!=this.colore)return true;
        else if(this.x+1<8 && this.y-2>=0 && scacchiera[this.x+1][this.y-2].prendi_colore()!=this.colore)return true;
        else if(this.x+2<8 && this.y-1>=0 && scacchiera[this.x+2][this.y-1].prendi_colore()!=this.colore)return true;
        else if(this.x+1<8 && this.y+2<8 && scacchiera[this.x+1][this.y+2].prendi_colore()!=this.colore)return true;
        else if(this.x+2<8 && this.y+1<8 && scacchiera[this.x+2][this.y+1].prendi_colore()!=this.colore)return true;
        else return false;
    }
}

class Alfiere extends Pezzo{
    constructor(x,y,colore){
        super(x,y,colore);
        this.tipo="Alfiere";
    }
    protegge(x_fine,y_fine,scacchiera){
        if(this.is_morto()) return false
        //x e y decrementano o aumentano con lo stesso valore in modulo a patto che non ci siano altri pezzi lungo il percorso
        else if(((this.x-x_fine)**2==(this.y-y_fine)**2)){
            if(x_fine>this.x)x_fine--;
            else x_fine++;
            if(y_fine>this.y)y_fine--;
            else y_fine++;
            return this.no_pezzi(x_fine,y_fine,scacchiera)
        }
        else return false;
    }
    possible_move(x_fine,y_fine,scacchiera){
        if(this.is_morto()) return false
        //x e y decrementano o aumentano con lo stesso valore in modulo a patto che non ci siano altri pezzi lungo il percorso
        else if(((this.x-x_fine)**2==(this.y-y_fine)**2)&& scacchiera[x_fine][y_fine].prendi_colore()!=this.colore){
            if(x_fine>this.x)x_fine--;
            else x_fine++;
            if(y_fine>this.y)y_fine--;
            else y_fine++;
            return this.no_pezzi(x_fine,y_fine,scacchiera)
        }
        else return false;
    }
    no_pezzi(x_fine,y_fine,scacchiera){
        if(x_fine==this.x && y_fine==this.y)return true;
        else if(scacchiera[x_fine][y_fine].prendi_colore()!="O") return false;
        else{
            if(x_fine>this.x)x_fine--;
            else x_fine++;
            if(y_fine>this.y)y_fine--;
            else y_fine++;
            return this.no_pezzi(x_fine,y_fine,scacchiera)
        }
    }
    can_move(scacchiera){
        if(this.is_morto()) return false
        //Alfiere can_move
        else if(this.x-1>=0 && this.y+1<8 && scacchiera[this.x-1][this.y+1].prendi_colore()!=this.colore)return true;
        else if(this.x-1>=0 && this.y-1>=0 && scacchiera[this.x-1][this.y-1].prendi_colore()!=this.colore)return true;
        else if(this.x+1<8 && this.y-1>=0 && scacchiera[this.x+1][this.y-1].prendi_colore()!=this.colore)return true;
        else if(this.x+1<8 && this.y+1<8 && scacchiera[this.x+1][this.y+1].prendi_colore()!=this.colore)return true;
        else return false;
    }
}

class Torre extends Pezzo{
    constructor(x,y,colore){
        super(x,y,colore);
        this.tipo="Torre";
        this.nevermove=true;
    }
    protegge(x_fine,y_fine,scacchiera){
        if(this.is_morto()) return false;
        //x o y decrementano o aumentano mentre l'altra rimane costante a patto che non ci siano altri pezzi lungo il percorso
        else if(scacchiera[x_fine][y_fine].prendi_colore()==this.colore){
            if(x_fine==this.x){
                if(y_fine>this.y)return this.no_pezzi(x_fine,y_fine-1,scacchiera);
                else return this.no_pezzi(x_fine,y_fine+1,scacchiera);
            }
            else if(y_fine==this.y){
                if(x_fine>this.x)return this.no_pezzi(x_fine-1,y_fine,scacchiera);
                else return this.no_pezzi(x_fine+1,y_fine,scacchiera);
            }
        }
        else return false;
    }
    possible_move(x_fine,y_fine,scacchiera){
        if(this.is_morto()) return false;
        //x o y decrementano o aumentano mentre l'altra rimane costante a patto che non ci siano altri pezzi lungo il percorso
        else if(scacchiera[x_fine][y_fine].prendi_colore()!=this.colore){
            if(x_fine==this.x){
                if(y_fine>this.y)return this.no_pezzi(x_fine,y_fine-1,scacchiera);
                else return this.no_pezzi(x_fine,y_fine+1,scacchiera);
            }
            else if(y_fine==this.y){
                if(x_fine>this.x)return this.no_pezzi(x_fine-1,y_fine,scacchiera);
                else return this.no_pezzi(x_fine+1,y_fine,scacchiera);
            }
        }
        else return false;
    }
    no_pezzi(x_fine,y_fine,scacchiera){
        if(x_fine==this.x && y_fine==this.y)return true;
        else if(scacchiera[x_fine][y_fine].prendi_colore()!="O") return false;
        else{
            if(x_fine==this.x){
                if(y_fine>this.y)y_fine--;
                else y_fine++;
            }
            else if(y_fine=this.y){
                if(x_fine>this.x)x_fine--;
                else x_fine++;
            }
            return this.no_pezzi(x_fine,y_fine,scacchiera)
        }
    }
    can_move(scacchiera){
        if(this.is_morto()) return false
        //Torre can_move
        else if(this.y+1<8 && scacchiera[this.x][this.y+1].prendi_colore()!=this.colore)return true;
        else if(this.y-1>=0 && scacchiera[this.x][this.y-1].prendi_colore()!=this.colore)return true;
        else if(this.x-1>=0 && scacchiera[this.x-1][this.y].prendi_colore()!=this.colore)return true;
        else if(this.x+1<8 && scacchiera[this.x+1][this.y].prendi_colore()!=this.colore)return true;
        else return false;
    }
}

class Regina extends Pezzo{
    constructor(x,y,colore){
        super(x,y,colore);
        this.tipo="Regina";
    }
    protegge(x_fine,y_fine,scacchiera){
        if(this.is_morto()) return false
        //Si muove come un alfiere o come una torre a patto che non ci siano altri pezzi lungo il percorso
        else if((((this.x-x_fine)**2==(this.y-y_fine)**2) || (this.x==x_fine || this.y==y_fine))&& scacchiera[x_fine][y_fine].prendi_colore()==this.colore && this.no_pezzi(x_fine,y_fine,scacchiera))
        return true;
        else return false;
    }
    possible_move(x_fine,y_fine,scacchiera){
        if(this.is_morto()) return false
        //Si muove come un alfiere o come una torre a patto che non ci siano altri pezzi lungo il percorso
        else if((((this.x-x_fine)**2==(this.y-y_fine)**2) || (this.x==x_fine || this.y==y_fine))&& scacchiera[x_fine][y_fine].prendi_colore()!=this.colore && this.no_pezzi(x_fine,y_fine,scacchiera))
        return true;
        else return false;
    }
    no_pezzi(x_fine,y_fine,scacchiera){
        //COME TORRE
        if(x_fine==this.x){
            if(y_fine>this.y)return(this.no_pezzi_torre(x_fine,y_fine-1,scacchiera));
            else return(this.no_pezzi_torre(x_fine,y_fine+1,scacchiera));
        }
        if(y_fine==this.y){
            if(x_fine>this.x)return(this.no_pezzi_torre(x_fine-1,y_fine,scacchiera));
            else return(this.no_pezzi_torre(x_fine+1,y_fine,scacchiera));
        }
        // COME ALFIERE
        else {
            if(x_fine>this.x)x_fine--;
            else x_fine++;
            if(y_fine>this.y)y_fine--;
            else y_fine++;
            return this.no_pezzi_alfiere(x_fine,y_fine,scacchiera);
        }
    }

    no_pezzi_torre(x_fine,y_fine,scacchiera){
        if(x_fine==this.x && y_fine==this.y)return true;
        else if(scacchiera[x_fine][y_fine].prendi_colore()!="O") return false;
        else{
            if(x_fine==this.x){
                if(y_fine>this.y)y_fine--;
                else y_fine++;
            }
            else if(y_fine=this.y){
                if(x_fine>this.x)x_fine--;
                else x_fine++;
            }
            return this.no_pezzi_torre(x_fine,y_fine,scacchiera)
        }
    }
    no_pezzi_alfiere(x_fine,y_fine,scacchiera){
        if(x_fine==this.x && y_fine==this.y)return true;
        else if(scacchiera[x_fine][y_fine].prendi_colore()!="O") return false;
        else{
            if(x_fine>this.x)x_fine--;
            else x_fine++;
            if(y_fine>this.y)y_fine--;
            else y_fine++;
            return this.no_pezzi_alfiere(x_fine,y_fine,scacchiera)
        }
    }
    can_move(scacchiera){
        if(this.is_morto()) return false
        //Regina can_move
        else if(this.x-1>=0 && this.y+1<8 && scacchiera[this.x-1][this.y+1].prendi_colore()!=this.colore)return true;
        else if(this.x-1>=0 && this.y-1>=0 && scacchiera[this.x-1][this.y-1].prendi_colore()!=this.colore)return true;
        else if(this.x+1<8 && this.y-1>=0 && scacchiera[this.x+1][this.y-1].prendi_colore()!=this.colore)return true;
        else if(this.x+1<8 && this.y+1<8 && scacchiera[this.x+1][this.y+1].prendi_colore()!=this.colore)return true;
        else if(this.y+1<8 && scacchiera[this.x][this.y+1].prendi_colore()!=this.colore)return true;
        else if(this.y-1>=0 && scacchiera[this.x][this.y-1].prendi_colore()!=this.colore)return true;
        else if(this.x-1>=0 && scacchiera[this.x-1][this.y].prendi_colore()!=this.colore)return true;
        else if(this.x+1<8 && scacchiera[this.x+1][this.y].prendi_colore()!=this.colore)return true;
        else return false;
    }
}

class Re extends Pezzo{
    constructor(x,y,colore){
        super(x,y,colore);
        this.tipo="Re";
        this.nevermove=true;
    }
    protegge(x_fine,y_fine,scacchiera){
        if(x_fine>7 || x_fine<0 || y_fine>7 || y_fine<0)return false
        //Si muove in un raggio unitario a patto che non ci siano pezzi dello stesso colore
        else if(((x_fine-this.x==0 || x_fine-this.x==1 || x_fine-this.x==-1)&&(y_fine-this.y==0 || y_fine-this.y==1 || y_fine-this.y==-1)))
        return true;
        else return false;
    }
    possible_move(x_fine,y_fine,scacchiera){
        if(x_fine>7 || x_fine<0 || y_fine>7 || y_fine<0)return false
        //Si muove in un raggio unitario a patto che non ci siano pezzi dello stesso colore
        else if(((x_fine-this.x==0 || x_fine-this.x==1 || x_fine-this.x==-1)&&(y_fine-this.y==0 || y_fine-this.y==1 || y_fine-this.y==-1)) && scacchiera[x_fine][y_fine].prendi_colore()!=this.colore)
        return true;
        else if(this.nevermove && this.colore=="B" && x_fine==7 && y_fine==2 && T0B.nevermove){

        }
        else return false;
    }
    can_move(scacchiera){
        if(this.is_morto()) return false
        //Re can_move
        else if(this.x-1>=0 && this.y+1<8 && scacchiera[this.x-1][this.y+1].prendi_colore()!=this.colore)return true;
        else if(this.x-1>=0 && this.y-1>=0 && scacchiera[this.x-1][this.y-1].prendi_colore()!=this.colore)return true;
        else if(this.x+1<8 && this.y-1>=0 && scacchiera[this.x+1][this.y-1].prendi_colore()!=this.colore)return true;
        else if(this.x+1<8 && this.y+1<8 && scacchiera[this.x+1][this.y+1].prendi_colore()!=this.colore)return true;
        else if(this.y+1<8 && scacchiera[this.x][this.y+1].prendi_colore()!=this.colore)return true;
        else if(this.y-1>=0 && scacchiera[this.x][this.y-1].prendi_colore()!=this.colore)return true;
        else if(this.x-1>=0 && scacchiera[this.x-1][this.y].prendi_colore()!=this.colore)return true;
        else if(this.x+1<8 && scacchiera[this.x+1][this.y].prendi_colore()!=this.colore)return true;
        else return false;
    }
}




sslServer.listen(3000);