---
title: Flutter - Widget, State, BuildContext ๊ทธ๋ฆฌ๊ณ  InheritedWidget (Part 1)
date: 2020-04-28 17:00:00 +0900
tags:
  - Flutter
  - Dart
  - Fundamental
emoji: ๐ป
author: ๊ฐ๋ฐํ์
categories: ๊ฐ๋ฐ
---

```toc
```

- STEP 1. ์๋ก 
- STEP 2. ๋ณธ๋ก 
  - STEP 2. StatelessWidget vs StatefulWiget
    - STEP 2.1 StatelessWidget vs StatefulWiget
    - STEP 2.2 Stateless Widget
    - STEP 2.3 Stateful Widget
      - STEP 2.3.1 State๋? 
    - STEP 2.3 StatelessWidget๊ณผ StatefulWidget ์ ํ ๋ฐฉ๋ฒ
- STEP 3. ๊ฒฐ๋ก 
- STEP 4. Reference

# Flutter - Widget, State, BuildContext ๊ทธ๋ฆฌ๊ณ  InheritedWidget Part 1
# STEP 1. ์๋ก 
Flutter ๊ณต์ํ์์ Flutter์ ๋ํด์ ์๊ฐํ๋ ํ ์ค ์ฝ๋ฉํธ๊ฐ ์๋ค.
> In Flutter, almost everything is a Widget.  

๋ง ๊ทธ๋๋ก Flutter๊ฐ ๊ฐ์ฅ ๊ฐ๋ ฅํ ์ด์ ๋ผ๊ณ  ๋ณผ ์ ์๋ ๊ฒ์ด ์ฌ๋ฏธ์ ์ผ๋ก ์๋ฆ๋ค์ด Material Design์ Widget๋ค์ ์ฝ๊ณ  ๋น ๋ฅด๊ฒ ์ฌ์ฉํ  ์ ์์ผ๋ฉฐ, ์ถ๊ฐ์ ์ผ๋ก ์ด์ ๋ํ ์์ฑ ๊ฐ์ ๋ณ๊ฒฝํ์ฌ ์์ ๋กญ๊ฒ ์ปค์คํฐ๋ง์ด์ง์ ํ  ์ ์๊ฒ ํด๋จ๋ค๋ ์ ์ด๋ค. 

์ฐ๋ฆฌ๋ ๋จ์ํ๊ฒ ์ด๊ฒ ์ด๋ ํ ๋ชจ์์ ์์ ฏ์ด๊ณ , ์ด๋ค ์์ฑ์ ๊ฐ๊ณ ์์ผ๋ฏ๋ก ์ด๋ ํ ๋ถ๋ถ์ ์ปค์คํฐ๋ง์ด์ง์ ํ๊ธฐ ์ํด์๋ ๋ฌด์์ ๋ฐ๊พธ๋ฉด ๋๋ค. ์ ๋๋ง ํด๋ ๋๊ตฌ๋ ์ ์ฝ๊ฒ ์ดํ๋ฆฌ์ผ์ด์ UI๋ฅผ ์ ์ํ๋ ์๋๊ฐ ์๋ค๊ณ  ์๊ฐํ๋ค.

ํ์ง๋ง ๊ณ์ํด์ ๊ฐ์๋ฅผ ๋ค์ผ๋ฉด์ ์ธ๋ฐ์๋ ์๊ฐ ๋ญ๋น๋ผ๊ณ  ํน์๋ ๋งํ ์ง๋ ๋ชจ๋ฅด๊ฒ ์ง๋ง, ๊ถ๊ธํ ๋ถ๋ถ์ด ์๊ฒจ๋ฌ์๊ณ  ์ค๋์ ๊ทธ ๋ถ๋ถ์ ๋ํด์ ์ ๋ฆฌ๋ฅผ ํ๊ณ ์ ํ๋ค. 


# STEP 2. ๋ณธ๋ก 
> ํ๋ฌํฐ์์๋ ๊ฑฐ์ ๋ชจ๋  ๊ฒ์ด ์์ ฏ์ด๋ค.  

๊ทธ๋ ๋ค๋ฉด, ์ฐ๋ฆฌ๊ฐ ๋ง๋  ์์ ฏ์ ์ด๋ ํ ๋ฐฉ์์ผ๋ก ๋ ๋๋ง์ด ๋๋ ๊ฒ์ผ๊น?
๋ฐ๋ก ์์ ฏํธ๋ฆฌ์ ์ํด์ ๋ ๋๋ง์ ํ๊ฒ ๋๋ค.


```dart
class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Flutter Demo',
      theme: ThemeData(
        primarySwatch: Colors.blue,
      ),
      home: MyHomePage(title: 'Flutter Demo Home Page'),
    );
  }
}

class MyHomePage extends StatefulWidget {
  MyHomePage({Key key, this.title}) : super(key: key);
  final String title;

  @override
  _MyHomePageState createState() => _MyHomePageState();
}

class _MyHomePageState extends State<MyHomePage> {
  int _counter = 0;

  void _incrementCounter() {
    setState(() {
      _counter++;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            Text(
              'You have pushed the button this many times:',
            ),
            Text(
              '$_counter',
              style: Theme.of(context).textTheme.display1,
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _incrementCounter,
        tooltip: 'Increment',
        child: Icon(Icons.add),
      ), // This trailing comma makes auto-formatting nicer for build methods.
    );
  }
}
```

์์ ์์ค์ฝ๋๋ Flutter ํ๋ก์ ํธ๋ฅผ ์์ฑํ๊ฒ ๋๋ฉด ์ฒ์ ์๊ธฐ๋ ์นด์ดํฐ ์์  ์ดํ๋ฆฌ์ผ์ด์์ด๋ค. 

์์์๋ถํฐ ์ฐจ๊ทผ์ฐจ๊ทผ ์ดํด๋ณด๊ฒ ๋ค.

```dart
class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Flutter Demo',
      theme: ThemeData(
        primarySwatch: Colors.blue,
      ),
      home: MyHomePage(title: 'Flutter Demo Home Page'),
    );
  }
}
```

์ฐ๋ฆฌ ์ดํ๋ฆฌ์ผ์ด์์ ์ต์์ ๋ธ๋๋ผ๊ณ  ๋ณผ ์ ์๋ `Myapp` ํด๋์ค์ด๋ค.
์ด `Myapp` ํด๋์ค๋ `StatelessWidget` ์ ์์ํ์ฌ, `build()` ๋ฉ์๋๋ฅผ ์ค๋ฒ๋ผ์ด๋ฉํด์ ์์ ฏ์ ๋ ๋๋งํ๊ฒ ๋๋ค. 

์ด๋ ๋ฆฌํด ๊ฐ์ผ๋ก `MaterialApp()`  ๊ฐ์ฒด๊ฐ ๋ฐํ๋๋๋ฐ ์ด ๊ฐ์ฒด์ ๋ํ ์ค๋ช์ ๋์ค์ ํ๊ณ , `home: MyHomePage(title: 'Flutter Demo Home Page')` ์ ๋ณด์, ๋์ถฉ ์ด ๊ฐ์ฒด๊ฐ ๋ฌด์์ ํ๋ ๋์ธ์ง๋ ๋ชจ๋ฅด๊ฒ ์ง๋ง, ์น ๊ฐ๋ฐ์ ํ๋ ์ฌ๋์ด๋ผ๋ฉด **home**์ด๋ผ๋ ์์ฑ์ ๋ฌด์์ธ๊ฐ ๋ฉ์ธ ํ์ด์ง๋ฅผ ๊ทธ๋ฆด ๊ฒ ๊ฐ๋ค๋ ๋์์ค๊ฐ ๋ค ๊ฒ์ด๋ผ๊ณ  ์๊ฐํ๋ค.

์ ๊ทธ๋ผ ์๋ ํด๋์ค๋ฅผ ๋ด๋ณด์.

```dart
class MyHomePage extends StatefulWidget {
  ... (์ค๋ต) ...
}

class _MyHomePageState extends State<MyHomePage> {
  ... (์ค๋ต) ...
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
      ),
      body: Center(
        ... (์ค๋ต) ...
      ),
      floatingActionButton: FloatingActionButton(
        ... (์ค๋ต) ...
      ), 
    );
  }
}
```

์์ ์ฝ๋๋ฅผ ๋ณด๋ฉด ๊ธธ๊ฒ ๋ณด์ด๊ฒ ์ง๋ง ํ๋ํ๋ ๋ฏ์ด๋ณด๋ฉด ๋ณ ๊ฑฐ ์๋ค. 
์๊น์ ์ ์ธ๊ธํ๋ฏ์ด `MaterialApp()` ์ ํ๋กํผํฐ ์์ฑ์ผ๋ก ์ ์๋ ์ด ๋ถ๋ถ์์  `home: MyHomePage(title: 'Flutter Demo Home Page')`  
**MyHomePage** ๊ฐ์ฒด ๋ถ๋ถ์ด๋ผ๊ณ  ๋ณด๋ฉด ๋  ๊ฒ์ด๋ค. 
์ฌ๊ธฐ์๋ `build(BuildContext context)` ๋ถ๋ถ๋ง ๋ณด์๋ฉด, ์๋ ๋ค์ `Scaffold()` ๊ฐ์ฒด์ ํ๋กํผํฐ๋ค์ ์ ์ํ ํ ๋ฆฌํดํ๋ ๋์ด๋ผ๊ณ  ๋ณผ ์ ์์ ๊ฒ์ด๋ค.

๋์ถฉ ๊ฒฐ๊ณผ๋ฌผ์ ๋ํด์ ๊ทธ๋ ค๋ณด์๋ฉด ์ด๋ฐ์์ผ๋ก ๊ทธ๋ ค์ง๋ค๊ณ  ๋ณผ ์ ์๋ค.

![Flutter-Start-Project](./flutter-widget-structure.png)

์ด๋ฅผ ์์ ฏ ํธ๋ฆฌ ํ์์ผ๋ก ๊ทธ๋ ค๋ณด์๋ฉด

![Flutter-Start-Project WidgetTree](./flutter-widget-tree-structure.png)

์ด๋ฌํ ํ์์ผ๋ก ๊ทธ๋ ค์ง ๊ฒ์ด๋ค. 

์ ์ด์  ์ข ๋ ๊น๊ฒ ๋ค์ด๊ฐ๋ณด์, ๊ทธ๋ ๋ค๋ฉด ์ฐ๋ฆฌ๊ฐ ์์ ฏ์ ๋ ๋๋งํ  ๋ ์ฌ์ฉํ๋ 
`Widget build(BuildContext context)`์ **๋น๋์ปจํ์คํธ**๋ ๋ฌด์์ผ๊น? 

๋น๋์ปจํ์คํธ(BuildContext)๋ **๋น๋ ๋ ๋ชจ๋  ์์ ฏ ํธ๋ฆญ ๊ตฌ์กฐ ๋ด์ ์์ ฏ ์์น์ ๋ํ ์ฐธ์กฐ**์ด๋ค. ์ฆ, **ํธ๋ฆฌ์ ๋ถ๋ชจ์์ ๊ด๊ณ๋ฅผ ๊ตฌ์ฑํ๊ธฐ ์ํ ๋ณ์**๋ผ๊ณ  ๋ณผ ์ ์๋ค. 

ํ์ฌ๊น์ง ๋ด์ฉ์ ์ ๋ฆฌํ์๋ฉด 
+ **์์ ฏํธ๋ฆฌ** : **Flutter์์ ์์ ฏ ๋ ๋๋ง์ ์ํด ์์ ฏ์ ๋ถ๋ชจ์์๊ด๊ณ๋ฅผ ํํํ๋ ๊ฒ**
+ **๋น๋์ปจํ์คํธ** : **๋น๋๋ ์์ ฏ ํธ๋ฆฌ ๊ตฌ์กฐ ๋ด์ ์์ ฏ ์์น์ ๋ํ ์ฐธ์กฐ๊ฐ**

์ด๋ผ๊ณ  ๋ณผ ์ ์๋ค. 

๊ทธ๋ ๋ค๋ฉด ์์ ์์ ์ฝ๋์์ `class MyApp extends StatelessWidget` ์ `class MyHomePage extends StatefulWidget` ์์์ `StatelessWidget` ์ `StatefulWidget` ๋ ๋ฌด์์ ๋ํ๋ด๋ ๊ฒ์ผ๊น? 

## STEP 2.1 StatelessWidget vs StatefulWiget
Flutter์์ ์ ๊ณตํ๋ ์์ ฏ๋ค์ ํฌ๊ฒ ํ์์ด 2๊ฐ์ง๋ก ๋๋์ด์ง๊ฒ ๋๋ค.

1. **StatefulWidget** 
2. **StatelessWidget** 

์ด๋ฆ์์๋ ๋ญ๊ฐ ๋๋์ด ์ค์ง์๋๊ฐ? Stateful Wiget์ ์ํ ๊ฐ(state)์ด ๋ณํํ๋ ์์ ฏ์ด๋ผ๊ณ  ๋ณผ ์ ์์ผ๋ฉฐ, Stateless Widget์ ์ํ ๊ฐ์ด ๋ณํํ์ง ์๋ ์์ ฏ์ด๋ผ๊ณ  ๋ณผ ์ ์๋ค.

### STEP 2.2 Stateless Widget
์ด ์์ ฏ์ ๋น๋ ํ์ด๋ฐ์ ๋ถ๋ชจ๋ก ๋ถํฐ ๋ฐ์ ์ ๋ณด์ ์์กดํ๋ ์ปดํฌ๋ํธ์ด๋ค.

**์ฆ, ํ ๋ฒ ๋น๋๋๋ฉด ์ ๊ฒฝ์ฐ์ง ์์๋ ๋๋ค๋ ๋ง์๋๋ค.**

์์๋ก๋ Text(), Container(), Column() ๋ฑ์ด ์๋ค. ์ด๋ฌํ ์์ ฏ๋ค์ ๋น๋ํ  ๋ ํ๋ผ๋ฏธํฐ๋ฅผ ๋จ์ํ ์ ๋ฌํ๋ค. ์ด๋ฌํ ํ๋ผ๋ฏธํฐ๋ฅผ ์ ๋ฌํด ํ๋ฒ ์ ์ฉ๋๋ฉด **๋ค์ ๋น๋๋ฅผ ํ๊ธฐ ์ ๊น์ง๋ ๋ณํ์ง๊ฐ ์๋ ์์ ฏ**์ด๋ค.

๋ค์ ์์ ์์  ์ฝ๋๋ฅผ ์ดํด๋ณด์. 

```dart
void main() => runApp(MyApp());

class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Flutter Demo',
      theme: ThemeData(
        primarySwatch: Colors.blue,
      ),
      home: MyHomePage(title: 'Flutter Demo Home Page'),
    );
  }
}
```

์ฐ๋ฆฌ๊ฐ ์คํ์ํฌ **Main UI**๊ฐ ๋ด๊ธด `MyApp` ํด๋์ค๊ฐ **StatelessWidget**์ด๋ผ๊ณ  ๋ณผ ์ ์๋ค. ์ด StatelessWidget์ ๋ผ์ดํ ์ฌ์ดํด์ ๋งค์ฐ ๋จ์ํ๋ค.  `build()` ๋ฉ์๋๋ฅผ ์ค๋ฒ๋ผ์ด๋ฉํ์ฌ, ์ด๊ธฐํ๋ฅผ ์ํํ๋ค. 	

### STEP 2.2 StatefulWidget
StatefulWidget๊ณผ ๊ฐ์ ๊ฒฝ์ฐ์๋ ์์ ฏ์ด ์ด์์๋ ๊ฒฝ์ฐ, ๋ด๋ถ ๋ฐ์ดํฐ๋ฅผ ๋ค๋ฃจ๋ ์์ ฏ์ด๋ค. ๋ฐ๋ผ์ **๋ฐ์ดํฐ๋ ์์ ฏ์ด ์ด์ ์๋ ๋์ ๋์ ์ผ๋ก ๋ณํ๋ค.**

์ด๊ฒ ๋ฐ๋ก StatelessWidget๊ณผ StatefulWidget์ ๊ฐ์ฅ ํฐ ์ฐจ์ด์ ์ด๋ผ๊ณ  ๋ณผ ์ ์๋ค.
์ด๋ฌํ **๋์ ์ผ๋ก ๋ณํํ๋ ๋ฐ์ดํฐ์ ์งํฉ**์ **State**๋ผ ๋ถ๋ฅธ๋ค.

์ฆ, StatefulWidget๊ณผ StatelessWidget์ ๊ฐ์ฅ ํฐ ์ฐจ์ด์ ์ ๋ด๋ถ์ **State**๋ฅผ ๊ฐ๊ณ ์๋๊ฐ? ์๋๊ฐ?๋ก ๋ณผ ์ ์๋ค.

StatefulWidget๊ณผ ๊ฐ์ ๊ฒฝ์ฐ์๋ ๋ด๋ถ์ State๋ฅผ ๊ฐ๊ณ  ์์ผ๋ฉฐ, ์๋ก๋ Silder(), CheckBox() ๋ฑ์ด ์๋ค.

์๋ ์ฝ๋๊ฐ StatefulWidget์ ์์์ด๋ค.

```dart
class MyHomePage extends StatefulWidget {
  @override
_MyHomePageState createState() => _MyHomePageState();
}

class _MyHomePageState extends State<MyHomePage> {
  ... (์ค๋ต) ...
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
      ),
      body: Center(
        ... (์ค๋ต) ...
      ),
      floatingActionButton: FloatingActionButton(
        ... (์ค๋ต) ...
      ), 
    );
  }
}

```

StatelessWidget๊ณผ ์กฐ๊ธ ๋ค๋ฅธ ์ ์, ํด๋์ค๊ฐ StatefulWidget๊ณผ State์์ ฏ์ผ๋ก ๋๋์ด์ง๋ค๋ ์ ์ด๋ค. ์ด ๋ถ๋ถ์ ๋ ๋ํ ๊ถ๊ธํด์ ์ฐพ์๋ดค๋๋ฐ, ์ฑ๋ฅ์ฐจ์ด ๋๋ฌธ์ ๋ถํ ํ๋ค๋ ๋ด์ฉ์ ๋ง์ด ๋ณด์๋ค. (ํ๋ ธ์ผ๋ฉด ์ง์ ๋ถํ๋๋ฆฝ๋๋ค.)

๊ทธ๋ ๋ค๋ฉด StatefulWidget์ ๋ผ์ดํ์ฌ์ดํด์ ์ด๋ป๊ฒ ๋ ๊น?

![StatefulWidget lifeCycle](./stateful-widget-lifecycle.jpeg)

1. **createState()**  
  + Flutter๊ฐ StatefulWidget์ ๋ง๋ค ๊ฒฝ์ฐ ์ฆ์ ์คํ
2. **mounted is true**
  + `createState()`๊ฐ ํธ์ถ๋๋ฉด `buildContext`๊ฐ state์ ํ ๋น๋.
    + `this.mounted = true` : buildContext๊ฐ state์ ํ ๋น์๋ฃ
    + `this.mounted = false` : buildContext๊ฐ state์ ํ ๋น์คํจ
    -> false์ผ ๊ฒฝ์ฐ `setState()` ํธ์ถ ์ ์๋ฌ ๋ฐ์ ๊ฐ๋ฅ์ฑ ์กด์ฌ
3. **initState()**
  + ์์ ฏ ์ธ์คํด์ค๋ฅผ ๋ง๋ค๊ธฐ ์ํด **BuildContext**๋ฅผ ์ด์ฉํด ๋ฐ์ดํฐ ์ด๊ธฐํ
4. **didChangeDependencies()**
  + `initState()` ํธ์ถ ์ดํ ์คํ ์์กดํ๋ ๊ฐ์ฒด๊ฐ ํธ์ถ๋  ๋๋ง๋ค ํธ์ถ 
5. **build()**
  + ์์ ฏ์ ๋ฆฌํด
  + `setState()` ํธ์ถ๋  ๋๋ง๋ค ํธ์ถ๋๋ค.
6. **didUpdateWidget(Widget oldWidget)**
  + ๋ถ๋ชจ ์์ ฏ์ด ์๋ฐ์ดํธ ๋๊ฑฐ๋ ์ด ์์ ฏ์ ๋ค์ ๋ง๋ค ๊ฒฝ์ฐ ํธ์ถ 
7. **deactivate()**
  + ํด๋น widget์ด ํธ๋ฆฌ์์ ์ ๊ฑฐ๋๋ ์๊ฐ ํธ์ถ
8. **dispose()**
  + ๋ชจ๋  ๋ ๋๋ง์ด ์์ ํ ๋๋ ํ, ์์ ํด์ ๋ฅผ ์ํด ํธ์ถ 
9. **mounted is false**

์์ธํ ๋ด์ฉ์ [Newbie Chapter 4. Widgetโs state - nhancv's blog](https://nhancv.com/newbie-chapter-4-widgets-state/)์ ์ฐธ๊ณ ํด๋ณด๋๋ก ํ์.
๋ผ์ดํ ์ฌ์ดํด๋ง ๋ด๋ Stateful Widget์ State๊ฐ ๊ด๋ฆฌ๋๋ ๊ฒ์ด ํต์ฌ์ด๋ผ๊ณ ๋ ๋ณผ ์ ์์ด๋ณด์ธ๋ค. ๊ทธ๋ ๋ค๋ฉด? State๋ ์ ํํ ๋ฌด์จ ์ผ์ ํ ๊น?

### STEP 2.2.1 State๋? 
์์์ ์ค๋ชํ ๋๋ก State์ ์ ์๋ **๋์ ์ผ๋ก ๋ณํํ๋ ๋ฐ์ดํฐ์ ์งํฉ**์ด๊ณ , ์ด๊ฑธ ํ๋ก๊ทธ๋๋ฐ์ ์ผ๋ก ๋ณด์๋ฉด , **StatefulWidget ์ธ์คํด์ค์ "ํ๋"์ ์ ์ํ๋ ๋ถ๋ถ**์ด๋ผ๊ณ  ๋ณผ ์ ์๋ค.

 ๊ทธ๋ ๊ธฐ์, **State๋ ์์ ฏ์ ๋์๊ณผ ๋ ์ด์์์ ์ํ ์ ๋ณด**๋ฅผ ๊ฐ์ง๊ณ  ์์ผ๋ฉฐ, **State๊ฐ ๋ณ๊ฒฝ๋๋ฉด ์์ ฏ์ ๋ฆฌ๋น๋**๊ฐ ๋๋ค.

๋๋ฆ ์ค์ํ๋ค๊ณ  ์๊ฐํ๋ ๋ถ๋ถ์ ์์ Stateful Widget ๋ผ์ดํ ์ฌ์ดํด์์ 2๋ฒ ๋ถ๋ถ์  ์ฐธ๊ณ ํ๋ฉด, `createState()` ์ดํ์ `BuildContext`๊ฐ **State**์  ํ ๋น๋๋ ๋ถ๋ถ์ด๋ค.  ์ด๋, State์ ํด๋น BuildContext ์ฌ์ด์๋ ์๊ตฌ์ ์ธ ์ฐ๊ด๊ด๊ณ๊ฐ ์๊ธฐ๋ฉฐ, State๊ฐ BuildContext๋ฅผ ์ ๋ ๋ณ๊ฒฝํ  ์ ์๊ฒ ๋ง๋ ๋ค.

๋ง์ฝ, ํด๋น BuildContext๊ฐ ๋ค๋ฅธ ํธ๋ฆฌ ๊ตฌ์กฐ๋ก ์ด๋๋๋ ๊ฒ์ด ๊ฐ๋ฅํ๋ค๊ณ  ํด๋, State๋ ํ๋ฒ mount๋ BuildContext์ ์ฐ๊ฒฐ์ ์ ์งํ๊ฒ ๋๋ค. 

์ด๋ ์ฆ, **State๊ฐ mount๋ BuildContext๊ฐ ์๋ ๋ค๋ฅธ BuildContext์ ์ ๊ทผ๊ฐ๋ฅํ์ง ์๊ฒ๋ ํ๋ ค๋ ์๋**๋ก ๋ณด์ธ๋ค. 

### STEP 2.3 StatelessWidget๊ณผ StatefulWidget ์ ํ ๋ฐฉ๋ฒ
์์์ ์ข ๊น๊ฒ StatelessWidget๊ณผ StatefulWidget์ ๋ค๋ค๋ดค๋ค. ๋ฐ๋ผ์ ์ด ๊ธ์ ๋ณด์  ๋ถ๋ค์ด๋ผ๋ฉด ์ค์ค๋ก ์๋์ ์ง๋ฌธ์ ํ  ์๊ฐ ์์ ๊ฒ์ด๋ค.

> ๋ด ์์ ฏ์ด ๋ผ์ดํ์ฌ์ดํด ๋์ ๋ณ๊ฒฝ๋  ๋ณ์๋ฅผ ๊ณ ๋ คํด์ผ ํ๋ฉฐ, ๋ณ๊ฒฝ ์ ์์ ฏ์ด ๊ฐ์ ๋ก ์ฌ๊ตฌ์ฑ์ด ๋  ์ ์๋๊ฐ?   

์ค์ค๋ก์๊ฒ ์ง๋ฌธ์ ํด๋ณด๊ณ  ๋ด๊ฐ ์ฌ์ฉํ  ์์ ฏ์ด ํด๋น ์ฌํญ์ด ์๋ค๋ฉด, StatefulWiget์ผ๋ก ๊ตฌ์ฑํ๋ฉด ๋๋ ๊ฒ์ด๊ณ , ์๋๋ผ๋ฉด StatelessWidget์ผ๋ก ์ ํํ๋ฉด ๋๋ค.

์์ ์ง๋ฌธ์ ๊ตฌ์ฒด์ ์ผ๋ก ์๋ ์ฌ๋ฆฐ๋ค ํ๋ฉด ์๋์ ์์์ ์์ ์ด ๋ง๋ค ์์ ฏ๊ณผ ๋น๊ตํด๋ณด์.

**1. ์ฒดํฌ๋ฐ์ค๋ฅผ ๋ณด์ฌ์ค์ผํ๋ ์์ ฏ์ด ์๋ค.**

์ฒดํฌ๋ฐ์ค์ ๋ฆฌ์คํธ๋ ๋ฐฐ์ด๋ก ๊ตฌ์ฑ๋์ด ์๊ณ , ๋ฐฐ์ด์ ์์๋ค์ ๊ฐ๊ฐ ๊ฐ์ฒด์ด๋ฉฐ ๊ทธ ๊ฐ์ฒด๋ค์ ์ ๋ชฉ๊ณผ ์ํ๋ฅผ๊ฐ๋๋ค.
๊ทธ๋ฆฌ๊ณ , ๋น์ ์ด ํด๋ฆญ์ ํ์ ๋ ๋ฐฐ์ด์ ์์์ ์ํ ๊ฐ์ด ๋ณํํ๋ค.

-> ์ด ๊ฒฝ์ฐ์๋ **StatefulWidget**์ ์ฌ์ฉํ๋ ๊ฒ์ด ์ข๋ค. ์ ์ผ๊น?

๋ฐ๋ก, **๋ฐฐ์ด์ ์์๋ค์ ์ํ ๊ฐ์ ๊ธฐ์ตํ์ฌ ์ฒดํฌ๋ฐ์ค๋ฅผ ๋ค์ ๊ทธ๋ฆฌ๊ฒ๋ ํด์ผ๋๊ธฐ ๋๋ฌธ์ด๋ค.**

**2. ํ์๊ฐ์์ ํ๋ ํผ์ด ์๋ค๊ณ  ๊ฐ์ ํด๋ณด์.** 

์ด ํผ์ ์ ์ ์๊ฒ ์๋ ฅ์ ๋ฐ์์ ์๋ฒ์ ๋ฐ์ดํฐ๋ฅผ ์ ๋ฌํ๋ ์ฉ๋์ด๋ค. ํผ ๊ฒ์ฆ์ ์๋ฒ ๋จ์์ ์ฒ๋ฆฌํ๋ค๊ณ  ๊ฐ์ ํ๋ค.

-> ์ด ๊ฒฝ์ฐ์๋ **StatelessWidget**์ ์ฌ์ฉํ๋ ๊ฒ์ด ์ข๋ค. ์ ์ผ๊น? 

๋ฐ๋ก, ํผ์ ๊ฒ์ฆํ๊ฑฐ๋ ์ ์ถํ๊ธฐ ์ ์ **์ด๋ ํ ํ๋์ ์์ ฏ์์ ์ฒ๋ฆฌํ  ๊ฒ์ด ์๊ธฐ ๋๋ฌธ์ด๋ค.**

# STEP 3. ๊ฒฐ๋ก 
์ง๊ธ๊น์ง ์ฐ๋ฆฌ๋ StatefulWidget๊ณผ StatelessWidget์ ๊ดํด์ ์ฌ์ธต์ ์ผ๋ก ๋ถ์์ ํด๋ดค๋ค. 

๋ค์์๋ ์ข ๋ ๊น์ด ๋ค์ด๊ฐ์ InheritedWidget์ ๋ํ ๊ฐ๋์ ๋ค๋ค๋ณด๋๋ก ํ๊ฒ ๋ค.

# STEP 4. REFERENCE
1. [Widget โ State โ BuildContext โ InheritedWidget - Flutter Community - Medium](https://medium.com/flutter-community/widget-state-buildcontext-inheritedwidget-898d671b7956)

2. [paulaner80 :: Widget, State, BuildContext ๊ทธ๋ฆฌ๊ณ  InheritedWidget](https://paulaner80.tistory.com/entry/Widget-State-BuildContext-%EA%B7%B8%EB%A6%AC%EA%B3%A0-InheritedWidget)

3. [Flutter Buildcontext Class - JACE SHIM](https://jaceshim.github.io/2019/01/25/flutter-study-buildcontext-class/)

4. [Flutter Stateful Widget Lifecycle](https://javaexpert.tistory.com/974)

5. [Flutter ๊ฐ๋จ ์ ๋ฆฌํ๊ธฐ - ๋ฐ์ฑ๋ฃก ( Andrew park ) - Medium](https://medium.com/@pks2974/flutter-%EA%B0%84%EB%8B%A8-%EC%A0%95%EB%A6%AC%ED%95%98%EA%B8%B0-9532e16aff57)