---
emoji: 🧢
title: 리눅스(CentOS7)에서 자바 개발환경 구축하기 - Nginx와 Tomcat연동
date: 2018-08-05 16:34:00 +0900
tags: 
- Linux
- centOS7
- Tomcat
- Nginx
- setting_environment
author: 개발한입
categories: 인프라
---

```toc
```

# 개요
이전장을 통해서 우리는 리눅스 상에서 jdk와 톰캣을 설치 및 환경설정을 하였다.
이번 장에서는 nginx의 reverse proxy기능을 이용하여 톰캣과 엔진엑스를 연동하는 방법을 알아보도록하겠다.

# Nginx와 Apache Tomcat 연동하기
 
+ STEP 1 - Nginx설치하기
   + STEP 1.1 - Install Nginx using webtatic repo **(비추천)**
     + STEP 1.1.1 EPEL 설치하기
     + STEP 1.1.2 Webatic 저장소 설치하기
     + Troubleshooting 
   + SETP 1.2 - Install Nginx using Nginx official repo **(추천)**
+ STEP 2 - Nginx를 사용하는 이유
	+ STEP 2.1 - Nginx 가상호스트 설정 **(참고만 하자)**
	+ STEP 2.2 - Nginx reverse proxy Tomcat에 적용
+ REFERENCE

- - - -

## STEP 1 - Nginx설치하기

### STEP 1.1 - Install Nginx using webtatic repo **(비추천)**
이번에는 바이너리 파일을 다운로드해서 설치하는게 아니라 webtatic이라는 프로그램을 통해서 최신 프로그램을 설치해보도록 하겠다.
- - - -
#### STEP 1.1.1 EPEL설치하기
먼저 webtatic을 설치하기 위해서는 EPLE(Extra Pakage for Enterprise Linux) [^1]라는 프로그램이 선행설치가 필요하다.
EPLE에 대해서 간단히 설명하면, 우리가 쓰는 리눅스 OS는 RHEL계열 배포판인데 RHEL은 최신버전의 프로그램의 사용보다는 안정성을 최우선으로 한다. 따라서 패키지 업데이트가 잘 안되는데 이러한 것을 EPEL을 사용하여 해결할 수가 있다.

간단히 얘기하면 yum에 없는 패키지나 최신버전이 아닌 패키지를 다운받을 수 있게하는 역할을 한다고 생각하면 된다.

따라서 최신 패키지를 사용하기 위해서는 epel나 remi, webtatic 저장소를 이용하는게 편하다.

설치법은 매우 간단하다.
CentOS7 환경에서는 단순하게 아래의 명령어를 입력하면 된다.
> rpm -Uvh https://dl.fedoraproject.org/pub/epel/epel-release-latest-7.noarch.rpm   
>    
실행결과는 아래와 같이 나온다. 
필자는 이미 설치되어서 이미 설치되어있다고 나온다.

```console 
[root@AzureCentOS azureuser]# rpm -Uvh https://dl.fedoraproject.org/pub/epel/epel-release-latest-7.noarch.rpm
Retrieving https://dl.fedoraproject.org/pub/epel/epel-release-latest-7.noarch.rpm
warning: /var/tmp/rpm-tmp.loyNno: Header V3 RSA/SHA256 Signature, key ID 352c64e5: NOKEY
Preparing...                          ################################# [100%]
```
- - - -

#### STEP 1.1.3 Webtatic저장소 설치하기
다양한 확장 저장소가 있지만 (remi, IUS 등) 그것은 추후에 포스팅하도록하고, Nginx 최신안정버전을 받을 수 있는 webtatic을 이용해서 Nginx를 다운받기로 한다. 

> 이것은 밑에서 Nginx 공식저장소로 다운받는거에 비해서 권장되지는 않으나 이런게 있구나정도로 넘어가면 되겠다.  

epel과 마찬가지로 아주 쉽게 설치할 수가 있다.
> rpm -Uvh https://mirror.webtatic.com/yum/el7/webtatic-release.rpm    

그 후에 yum repolist로 repository가 잘 등록되었는지 확인한다.

```console
[root@AzureCentOS azureuser]# yum repolist
Loaded plugins: fastestmirror
Repository nodesource is listed more than once in the configuration
Repository nodesource-source is listed more than once in the configuration
Loading mirror speeds from cached hostfile
 * epel: mirror.premi.st
 * remi-safe: ftp.riken.jp
 * webtatic: sp.repo.webtatic.com
repo id                                        repo name 
...       
```

> Loading mirror speeds from cached hostfile     
 epel: mirror.premi.st  
 webtatic: sp.repo.webtatic.com  

이런식의 문구가 나온다면 성공적으로 설치가 된 것이다.
만일 저 문구가 나오지 않는다면, 
> sudo  vi /etc/yum.repos.d/webtatic.repo    
명령어를 입력후에 **enable=1**로 수정한다.

그리고 webtatic보다 nginx 공식 저장소를 추천하는 이유가 이제서야 나오는데 지금 글 작성 시점 ('18.07.22)에서 nginx LTS버전은 **1.14.0**이다. 
하지만 webtatic 저장소의 버전 [^2]은 1.10.3으로 레거시버전이다. 
이 버전을 이용하려는 사람은 설치해도 무방하나 왠만하면 nginx 공식 저장소를 이용한 설치를 추천한다. 

또한 1.10.3을 바로 설치하는 방법이 아니라 1.8버전을 설치 후  업그레이드 하는 방식 [^3]을 취한다.    

일단 yum말고 다른 저장소를 사용한다는데에 의의를 두고 (공부목적) 위에서 언급한 바와 같이
> "이런 방법이 있구나!!" 생각하고 넘어가자.  

만약 난 여기까지 왔고, 그냥 webtatic을 사용하여 설치하고 싶다는 분들을 위해서 계속해서 방법을 적어보도록 하겠다.

이후의 단계는 Webtatic저장소를 이용하여 Nginx1.8를 설치 후에 1.10.3을 업그레이드하는 단계가 남아있다.

먼저 webtatic저장소를 이용하여 설치하는 방법은 매우 간단하다 위의 단계를 착실히 수행했다면 아래의 명령어를 입력한다.
> yum install nginx18    

그러면 자신의 CentOS7에 nginx설치는 완료되며 관련 설정파일들은 (ex : nginx.conf) **/etc/nginx** 경로안에 있다. 

이제 바로 Nginx1.8버전을 1.10.3으로 업그레이드를 해보자!
> yum install yum-plugin-replace    
  yum replace nginx18 --replace-with=nginx1w  
  systemctl restart nginx  

위의 명령어를 입력하면 1.8 버전 nginx가 1.10.3으로 대체가 된다.

해당 명령어로 업그레이드할 시에 
> WARNING: Unable to resolve all providers …     

이러한 에러가 나오면 정상적인 상황이니까 당황하지말고 **y**를 입력하자!

- - - -

#### Troubleshooting
만약 설치가 제대로 안된다면, 공식사이트에서는 해당 명령어를 입력해보는 것을 권장하고 있다.
```console
yum shell
remove nginx18
install nginx1w
run
systemctl restart nginx
```
- - - -
### SETP 1.2 - Install Nginx using Nginx official repo (**추천**)
필자는 이 방법으로 Nginx를 설치하는것을 권장하고있다!

RHEL 배포판에는 Nginx을 포함하고 있지않으므로, Nginx repo를 직접 추가해줘야한다.

아래의 명령어를 따라하자! 
```console
[azureuser@AzureCentOS ~]$ sudo vi /etc/yum.repos.d/nginx.repo

#vi 편집기를 연 후에 아래의 내용 작성

[nginx]
name=Nginx Repository \$basearch - Archive 
baseurl=http://nginx.org/packages/centos/\$releasever/\$basearch/
enabled=1
gpgcheck=1
gpgkey=https://nginx.org/keys/nginx_signing.key

#저장 후에 (wq) 제대로 적용됐는지 확인
[azureuser@AzureCentOS ~]$ yum info nginx
Installed Packages
Name        : nginx
Arch        : x86_64
Epoch       : 1
Version     : 1.14.0
Release     : 1.el7_4.ngx
Size        : 2.6 M
Repo        : installed
From repo   : nginx
Summary     : High performance web server
URL         : http://nginx.org/
License     : 2-clause BSD-like license
Description : nginx [engine x] is an HTTP and reverse proxy server, as well as
            : a mail proxy server.
```
필자 같은 경우에는 설치가 되어있으므로, **installed**라고 나온다. 
1.14.0 (LTS)버전이 설치된 것을 확인할 수가 있다.

설치 및 부팅시 자동 구동하도록 설정하기 위해서는
```console
[azureuser@AzureCentOS ~]$ sudo yum install nginx

#설치 완료 후 시작데몬 등록 
[azureuser@AzureCentOS ~]$ sudo systemctl enable nginx
[azureuser@AzureCentOS ~]$ sudo systemctl restart nginx
```
이렇게 하면 nginx 공식 저장소를 이용하여 nginx를 설치하는 것을 끝낼 수가 있다.

- - - -
## STEP 2 - Nginx를 사용하는 이유
Tomcat을 사용하는데 왜 Nginx를 굳이 쓸까? 하는 이유를 갖는 사람들이 많을 것이다.
일단 먼저 차이점을 알아야한다. Tomcat은 서블릿 컨테이너를 포함한 WAS(Web Application Server)이다. Nginx는 강력하고 단순한 웹서버로서 특히, 가상호스트 설정과 리버스 프록시를 구축하는데 자주 사용되는 웹서버이다.

즉, 사용자의 Http 요청은 Http Server(= Web Server)로 받은 후에 다시 웹서버가 WAS에 필요한 내용을 전달한 후에 WAS에서 처리 후에 다시 웹서버가 클라이언트에게 표현하는 식으로 구현하는 것이다. 

![웹서버와 WAS의 처리 방법](/assets/images/EFD108B9-A993-4AFA-8473-4EDF05EE6AD6.png)

해당 내용은 이미지인 출처인 [WAS와 웹서버의 차이](http://gap85.tistory.com/45)에서 자세하게 확인할 수가 있다. 간단하게 설명하자면, 톰캣은 동적 서버콘텐츠를 수행하고, 웹서버는 정적 서버콘텐츠를 수행한다는 점이다.

그리고 Nginx는 가장 큰 장점인 매우 쉬운 가상호스트 설정으로 하나의 서버에서 여러개의 웹서버를 구동함하는 장점을 갖는다.

![Nginx 가상호스트](/assets/images/EF22FD5B-744C-4780-9D1A-BCF9FF7AEDB8.gif)

위의 도식표를 보면 이해가 될 것이다.
사용자가 news에 대한 요청을 하면 해당 도메인에 엮인 부분을 Nginx가 읽고, 해당 디렉토리에 있는 콘텐츠를 응답하고, blog에 대한 질의를 하면 blog 디렉토리에 있는 콘텐츠를 응답한다.

그리고 Reverse Proxy는 액세스 포인트를 주어서 각기 다른 도메인을 사용해도, 한 액세스 포인트에서 로그관리와 클라이언트 요청에 맞게 url 매핑을 하는 기능을 수행한다.

아래의 그림을 보자.
![Nginx 리버스프록시](/assets/images/CF80CCA8-CE9D-4D9E-8B08-918D6F03CEAA.png)

위와 같은 도식을 통해서 Reverse Proxy의 장점을 정리하자면 아래와 같이 볼 수가 있다.

1. 서버의 부하를 덜어줄수 있는 로드 밸런싱 처리
2. 각 서버의 부하를 덜어준 만큼 웹서버 속도 증대
3. 보안과 익명성
4. 중앙 집중식 log 작성과 감시
5. 캐쉬사용

위와 같은 기능을 아주 쉽게 Nginx가 제공한다는 것이다.
따라서, 앞으로는 가상호스트 설정 및 리버스프록시 설정을 해보자한다.

- - - -

### STEP 2.1 - Nginx가상호스트설정 **(동작안하니까 참고만 하자!!!)**
우분투와 달리 (우분투는 sites-enabled/ 디렉토리 아래에 해당 가상호스트 설정을 집어 넣으면 끝이다.) RHEL 배포판은 가상호스트 설정을 하기가 좀 불편하다.

이번에는 CentOS7에서도 우분투처럼 가상호스트를 관리하기 위한 설정을 해보고자 한다.
일단, 우리가 설치한 Nginx의 경로는 */etc/nginx*이다.
아래의 폴더에 가상호스트를 관리하기위한 설정을 해보겠다.

```console
[azureuser@AzureCentOS nginx] sudo mkdir /etc/nginx/sites-available/
[azureuser@AzureCentOS nginx] sudo mkdir /etc/nginx/sites-enabled/
```

이후 Nginx의 설정파일인 Nginx.conf를 수정하는데 자세한 내용은 
[Nginx의 기본 구성](http://technerd.tistory.com/19)으로 대체하겠다.
만일 필요하다면 필요한 부분을 따로 포스팅하도록 하겠다.

주요 설정 부분만 정리하자면 아래와 같다.

**worker_processes** : 별도의 프로세스로 구동되어 실제 처리를 하는 프로세스의 갯수. cpu의 core 갯수를 확인한 후 이 숫자대로 주는게 좋다.

**worker_connections** : 워커 프로세스당 동시에 처리할 수 있는 연결 갯수. 기본 값 768

**max_clients**= **worker_processes** * **worker_connections**

기본 설정예시는
[Nginx Full Example Configuration](https://www.nginx.com/resources/wiki/start/topics/examples/full/#nginx-conf)을 참고할 수 있다.

필자는 이런식으로 사용하고 있다.
```console
# For more information on configuration, see:
#   * Official English Documentation: http://nginx.org/en/docs/
#   * Official Russian Documentation: http://nginx.org/ru/docs/

user  nginx;
worker_processes  4;
error_log  /var/log/nginx/error.log;  
pid        /var/run/nginx.pid;
 
events {
    worker_connections  2048;
}
 
http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
                      '$status $body_bytes_sent "$http_referer" '
                      '"$http_user_agent" "$http_x_forwarded_for"';
  access_log  /var/log/nginx/access.log  main;
    sendfile        on;
    #tcp_nopush     on;
    #keepalive_timeout  0;
    keepalive_timeout  65;
    server_tokens off;
    gzip  on;
    gzip_disable "msie6";
    ##
    # SSL Settings
    ##
    ssl_protocols TLSv1 TLSv1.1 TLSv1.2; # Dropping SSLv3, ref: POODLE
    ssl_prefer_server_ciphers on;
    # Virtual Host Configs
    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
```

만약, www.aaa.com과 www.bbb.com이라는 두 개의 도메인을 한 서버에서 동작하기 위해서는 아래와 같이 한다.

필자는 3가지의 파일을 만들었는데 
1. default (tomcat upstream 파일)
2. www.aaa.com (www.aaa.com 가상호스트 설정 파일)
3. www.bbb.com (www.bbb.com 가상호스트 설정 파일)

```console
    [root@AzureCentOS nginx]# cd sites-enabled/
    [root@AzureCentOS sites-enabled]# vi default
    
    # default 파일
    upstream tomcat {
     server  127.0.0.1:8080  fail_timeout=0;
    }

    [root@AzureCentOS sites-enabled]# vi www.aaa.com 
    #www.aaa.com 설정파일
          location / {
                  proxy_redirect off;
                  proxy_pass_header Server;
 
                  proxy_set_header Host $http_host;
                  proxy_set_header X-Forwarded-Proto $scheme;
                  proxy_set_header X-Forwarded-Port $server_port;
                  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                  proxy_set_header X-Real-IP $remote_addr;
                  proxy_set_header X-Scheme $scheme;
                  proxy_pass http://tomcat;
                  charset utf-8;
          }
    }

    [root@AzureCentOS sites-enabled]# vi www.bbb.com
    #www.bbb.com 설정파일
         location / {
                  proxy_redirect off;
                  proxy_pass_header Server;
 
                  proxy_set_header Host $http_host;
                  proxy_set_header X-Forwarded-Proto $scheme;
                  proxy_set_header X-Forwarded-Port $server_port;
                  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                  proxy_set_header X-Real-IP $remote_addr;
                  proxy_set_header X-Scheme $scheme;
                  proxy_pass http://tomcat;
                  charset utf-8;
          }
    }
```

이런식으로 설정 한 후에 tomcat의 server.xml 파일을 수정한다.
```console
[root@AzureCentOS nginx]# cd /opt/tomcat/
[root@AzureCentOS tomcat]# vi conf/server.xml
<Connector port="8080" protocol="HTTP/1.1"
               connectionTimeout="20000"
               URIEncoding="UTF-8"
               address="127.0.0.1" (기존 server.xml에서 추가)
               redirectPort="8443" />

...
    #호스트 설정
    <Host name="www.aaa.com" appBase="/var/www/aaa" autoDeploy="true"  xmlValidation="false" xmlNamespaceAware="false">
              <Context path="/" docBase="" reloadable="true" />
      </Host>
      <Host name="www.bbb.com" appBase="/var/www/bbb" autoDeploy="true"  xmlValidation="false" xmlNamespaceAware="false">
              <Context path="/" docBase="" reloadable="true" />
      </Host>
  </Engine>
  </Service>
</Server> 
```

이런식으로 설정하는 것이 가상 호스트이다.
이번에는 server.xml의 호스팅을 이용하여 멀티도메인을 적용했지만, 차후에 무중단 배포를 구현하는 와중에 따로 또 톰캣과 Nginx를 뜯어 고칠 것이니 참고만하자.

- - - -
### STEP 2.2 - Nginx & Apache Tomcat 리버스프록시설정
이번에는 아주 간단한 리버스프록시를 구현해보려한다. 

Nginx는 css, html, js같은 파일만 처리하고, jsp처리는 tomcat에 맡기는 식으로 리버스프록시를 설정하려고 한다. 

즉, 정적콘텐츠는 Nginx가 처리하고, 동적콘텐츠는 Tomcat이 처리하는 부분이다.
```console
[root@AzureCentOS conf.d]# cd /etc/nginx/conf.d/
[root@AzureCentOS conf.d]# vi tomcat.conf
upstream tomcat {
    ip_hash;
    server 127.0.0.1:8080;
}

server {
    listen 80;
    server_name www.server.com server.com;
    access_log /var/log/nginx/test1.log;

location / {
        root /usr/share/nginx/html;
        index index.html index.htm index.jsp;
    }

    location ~ \.(css|js|jpg|jpeg|gif|htm|html|swf)$ {
        root /usr/share/nginx/html;
        index index.html index.htm;
    }

    location ~ \.(jsp|do)$ {
    index index.jsp;
        proxy_pass http://tomcat;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-NginX-Proxy true;
        proxy_set_header Host $http_host;
    
    proxy_redirect off;
    charset utf-8;
    }

    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}
```

설정파일을 설명하자면 
```
location ~ \.(css|js|jpg|jpeg|gif|htm|html|swf)$ {
        root /usr/share/nginx/html;
        index index.html index.htm;
    }
```

위의 부분은 css, js, html등 기타 명시된 확장자의 경우 /usr/share/nginx/html에서 불러오겠다는 뜻이 된다. 
따라서 위의 확장자명에 해당하는 파일을 tomcat의 ROOT에 둘 경우에는 무시가 된다. 
즉, Tomcat은 온전히 *.do에 해당하는 액션이나 jsp파일을 처리하기만 한다.* 

그러한 설정부분을 보자면
```
location ~ \.(jsp|do)$ {
    index index.jsp;
        proxy_pass http://tomcat;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-NginX-Proxy true;
        proxy_set_header Host $http_host;
    
    proxy_redirect off;
    charset utf-8;
    }
```
위의 코드를 통하여 해당 질의를 수행한다고 볼 수가 있다.
이렇게 설정된 리버스프록시는 톰캣은 동적인 처리를 맡고, Nginx는 정적 처리를 맡음으로서 부하 분산을 할 수 있다는 장점이 있다!

다음장에서는 아래와 같은 멀티도메인 리버스프록시 도식과 같은 서버를 구축해보는 것을 무중단 배포 구현을 통해서 해보도록 하겠다.
![mulit-domain-reverse-proxy](/assets/images/D6A49F05-D5B6-4978-8CA9-590EC0EEEC83.png)

- - - -
# REFERENCE
1. [Yum 저장소 추가하기](https://conory.com/blog/42596)
2. [RHEL/CentOS 5,6,7 에 EPEL 과 Remi/WebTatic Repository 설치하기](https://www.lesstif.com/pages/viewpage.action?pageId=6979743)
3. [NGINX에서 멀티사이트 운영하기 – 가상호스트(Virtual Host) 설정법](https://itrend.site/7/nginx에서-멀티사이트-운영하기-가상호스트virtual-host-설정법/)
4. [우분투 NGINX(엔진엑스) 가상호스트 설정](http://webdir.tistory.com/241)
5. [WAS와 웹서버의 차이 – 톰캣과 아파치를 구별하지 못하는 사람을 위해](http://sungbine.github.io/tech/post/2015/02/15/tomcat과%20apache의%20연동.html)
6. [nginX에서 reverse proxy(리버스 프록시) 사용하기](http://akal.co.kr/?p=1173)

[^1]: ~https://fedoraproject.org/wiki/EPEL~
[^2]: ~https://webtatic.com/tags/nginx/~
[^3]: ~https://webtatic.com/packages/nginx110/~
