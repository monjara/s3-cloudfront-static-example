import * as cdk from 'aws-cdk-lib';
import { CfnOriginAccessControl, Distribution, HttpVersion, PriceClass } from 'aws-cdk-lib/aws-cloudfront';
import { S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { BlockPublicAccess, Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export class S3CfStaticExampleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Bucket
    const bucket = new Bucket(this, 'PrivateBucket', {
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
    })

    // OAC
    const originAccessControl = new CfnOriginAccessControl(this, 'OriginAccessControl', {
      originAccessControlConfig: {
        name: 's3-origin-access-control',
        originAccessControlOriginType: 's3',
        signingBehavior: "always",
        signingProtocol: "sigv4"
      }
    })

    // cloudfront
    const distribution = new Distribution(this, 'Distribution', {
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: new S3Origin(bucket),
      },
      priceClass: PriceClass.PRICE_CLASS_200,
      httpVersion: HttpVersion.HTTP1_1,
      enableLogging: false,
      enableIpv6: false,
    })

    const bucketPoricyStmt = new PolicyStatement({
      actions: ['s3:GetObject'],
      effect: Effect.ALLOW,
      principals: [
        new cdk.aws_iam.ServicePrincipal('cloudfront.amazonaws.com')
      ],
      resources: [`${bucket.bucketArn}/*`]
    })

    bucketPoricyStmt.addCondition('StringEquals', {
      'AWS:SourceArn': `arn:aws:cloudfront::${cdk.Stack.of(this).account}:distribution/${distribution.distributionId}`
    })

    bucket.addToResourcePolicy(bucketPoricyStmt)

    const cfnDistribution = distribution.node.defaultChild as cdk.aws_cloudfront.CfnDistribution
    cfnDistribution.addPropertyOverride('DistributionConfig.Origins.0.OriginAccessControlId', originAccessControl.getAtt('Id'))
    cfnDistribution.addPropertyOverride('DistributionConfig.Origins.0.DomainName', bucket.bucketRegionalDomainName)
    cfnDistribution.addOverride('Properties.DistributionConfig.Origins.0.S3OriginConfig.OriginAccessIdentity', "")
    cfnDistribution.addPropertyDeletionOverride('DistributionConfig.Origins.0.CustomOriginConfig')

    new cdk.aws_s3_deployment.BucketDeployment(this, 'CDKReactDeployPractice', {
      sources: [cdk.aws_s3_deployment.Source.asset('dist')],
      destinationBucket: bucket,
      distribution,
      distributionPaths: ['/*']
    })

  }
}
