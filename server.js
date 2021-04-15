require('dotenv').config();

var express=require('express');
const { emit, nextTick } = require('process');
var app=express();
var request = require('request');
var http=require('http').Server(app);
var io =require('socket.io')(http);
const url="http://localhost:3000";
const url_db="http://admin:admin@localhost:5984"


const client_id=process.env.GOOGLE_CLIENT_ID;
const client_secret=process.env.GOOGLE_CLIENT_SECRET;
const client_id_twitch=process.env.TWITCH_CLIENT_ID;
const client_secret_twitch=process.env.TWITCH_CLIENT_SECRET;

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
    res.sendFile(__dirname + '/index.html');
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
        mantieni_partita(data.partenza,data.arrivo,data.tipo).then(function(last_move){
           new_data={
               partenza:data.partenza,
               arrivo:data.arrivo,
               tipo:data.tipo,
               last_move:last_move
           }
            io.sockets.to(room).emit('next_move',new_data);
        });
        
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

http.listen(3000);