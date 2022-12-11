exports.handler = async (event, context) => {
    if(event.Payload){
        event = JSON.parse(event.Payload);
    }
  
    // Check status and
    var result = true;

    if(result)
    {
        event.continue = false;
        event.wait = -1;
    }
    else
    {
        event.continue = true;
        event.wait = 10; // 10 seconds wait
    }

    context.succeed(event); //change the state
};