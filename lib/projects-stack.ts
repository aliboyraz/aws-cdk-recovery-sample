import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Queue, QueueEncryption } from 'aws-cdk-lib/aws-sqs';
import { Duration } from 'aws-cdk-lib';
import { AccountPrincipal, ManagedPolicy, PolicyStatement, Role } from 'aws-cdk-lib/aws-iam';
import { Code, Runtime, Function } from 'aws-cdk-lib/aws-lambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { Choice, Condition, LogLevel, Pass, StateMachine, Wait, WaitTime } from 'aws-cdk-lib/aws-stepfunctions';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';

export class ProjectsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create SQS Queue,

  let deadLetterQueue = new Queue(this, "SampleQueueDeadLetterQueue", {
      queueName: "SampleQueueDeadLetterQueue",
      encryption: QueueEncryption.KMS_MANAGED,
      retentionPeriod: Duration.days(14),
  });

  let queue = new Queue(this, "SampleQueue", {
      queueName: "SampleQueue",
      encryption: QueueEncryption.KMS_MANAGED,
      visibilityTimeout: Duration.seconds(35),
      deadLetterQueue : {
          maxReceiveCount: 1,
          queue: deadLetterQueue
      }
  });

  const lambdaPolicy = new PolicyStatement()
  lambdaPolicy.addActions("sqs:ReceiveMessage")
  lambdaPolicy.addResources(queue.queueArn)

    //SQS Consumer Lambda
    let sqsConsumberFunction = new Function(this, "SampleAppSQSConsumerHandler", {
      functionName: "SqsConsumerHandler",
      handler: "lambda-sqs-consumer.handler",
      runtime: Runtime.NODEJS_14_X,
      code: Code.fromAsset("./lib/assets"),
      memorySize: 512,
      timeout: Duration.seconds(30),
      initialPolicy: [lambdaPolicy],
      events: [new SqsEventSource(queue)]
    })

  // const sendMessagePolicy = new PolicyStatement();
  // sendMessagePolicy.addActions("sqs:SendMessage");
  // sendMessagePolicy.addResources(queue.queueArn);
  // sendMessagePolicy.addResources(deadLetterQueue.queueArn);

  let logGroup = new LogGroup(this, "ValUStateMachineLogGroup", {
    logGroupName: "ValUStateMachineLogs"
});

  //State Machine
  let stateMachine = new StateMachine(this, "SampleAppTransactionStateMachine", {
    definition : this.createStates(),
    tracingEnabled: true,
    logs: {
      includeExecutionData: true,
      level: LogLevel.ALL,
      destination: logGroup
  }
});

  sqsConsumberFunction.addEnvironment("statemachine_arn",stateMachine.stateMachineArn);
  queue.grantConsumeMessages(sqsConsumberFunction);
}

  createStates(){
    let transactionStatusState = new LambdaInvoke(this, "TransactionStatus", {
      lambdaFunction: new Function(this, "TransactionStatusFunction", {
        functionName: "TransactionStatusFunction",
        handler: "transaction-status.handler",
        runtime: Runtime.NODEJS_14_X,
        code: Code.fromAsset("./lib/assets"),
        memorySize: 512,
        timeout: Duration.seconds(30),
        initialPolicy: null!,
      }),
      outputPath: "$.Payload"
  });

    let waitState = new Wait(this, "Wait", {
        time: WaitTime.secondsPath("$.wait")
    })

    let responseChecker = new Choice(this, "ResponseChecker")
    let pass = new Pass(this,"Done")
    
    transactionStatusState.next(responseChecker)
    responseChecker.when(Condition.booleanEquals("$.continue", true), waitState).otherwise(pass)
    waitState.next(transactionStatusState)

    return transactionStatusState;
}
}
